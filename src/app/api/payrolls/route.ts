import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Payroll } from "@/models/Payroll";
import { Payslip } from "@/models/Payslip";
import { Attendance } from "@/models/Attendance";
import { Leave } from "@/models/Leave";
import { LeaveType } from "@/models/LeaveType";
import { User } from "@/models/User";
import { requireUser, assertOrgAccess, canRunPayroll } from "@/lib/rbac";
import { jsonOk, jsonErr, workingDaysInMonth } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const generateSchema = z.object({
  orgId: z.string().min(1),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await dbConnect();
  const rows = await Payroll.find({ orgId }).sort({ year: -1, month: -1 });
  return jsonOk(serializeMany(rows));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!canRunPayroll(user!)) return jsonErr("Forbidden", 403);

  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());
  const { orgId, month, year } = parsed.data;
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await dbConnect();

  let payroll = await Payroll.findOne({ orgId, month, year });
  if (payroll) {
    await Payslip.deleteMany({ payrollId: payroll._id });
    payroll.generatedBy = user!.id as never;
    payroll.status = "final";
    await payroll.save();
  } else {
    payroll = await Payroll.create({
      orgId,
      month,
      year,
      status: "final",
      generatedBy: user!.id,
    });
  }

  const workingDays = workingDaysInMonth(year, month);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const staff = await User.find({
    orgId,
    type: { $in: ["member", "projectManager"] },
    active: true,
  });

  const unpaidTypes = await LeaveType.find({ orgId, paid: false });
  const unpaidTypeIds = new Set(unpaidTypes.map((t) => String(t._id)));

  const slips = [];
  for (const member of staff) {
    const attendance = await Attendance.find({
      userId: member._id,
      orgId,
      date: { $regex: `^${prefix}` },
    });

    const presentDays = attendance.filter((a) =>
      ["present", "half_day", "leave"].includes(a.status)
    ).length;

    const leaveRows = await Leave.find({
      userId: member._id,
      orgId,
      status: "approved",
      from: { $lte: `${prefix}-31` },
      to: { $gte: `${prefix}-01` },
    });

    let unpaidDays = 0;
    for (const lr of leaveRows) {
      if (unpaidTypeIds.has(String(lr.typeId))) unpaidDays += lr.days;
    }

    const payableDays = Math.max(0, Math.min(workingDays, presentDays));
    const basic = member.salary?.basic ?? 0;
    const allowances = member.salary?.allowances ?? 0;
    const fixedDeductions = member.salary?.deductions ?? 0;
    const prorated =
      workingDays > 0 ? (basic * payableDays) / workingDays : 0;
    const unpaidDeduction =
      workingDays > 0 ? (basic * unpaidDays) / workingDays : 0;
    const leaveDeficitDays = (member.credits || []).reduce(
      (sum: number, c: { balance: number }) =>
        sum + Math.max(0, -Number(c.balance || 0)),
      0
    );
    const leaveDeduction =
      workingDays > 0 ? (basic * leaveDeficitDays) / workingDays : 0;
    const deductions = fixedDeductions + unpaidDeduction + leaveDeduction;
    const earnings = prorated + allowances;
    const net = Math.round((earnings - deductions) * 100) / 100;

    const slip = await Payslip.create({
      payrollId: payroll._id,
      userId: member._id,
      orgId,
      presentDays: payableDays,
      workingDays,
      basic,
      earnings: Math.round(earnings * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      net,
      breakdown: {
        prorated: Math.round(prorated * 100) / 100,
        allowances,
        fixedDeductions,
        unpaidDays,
        unpaidDeduction: Math.round(unpaidDeduction * 100) / 100,
        leaveDeficitDays,
        leaveDeduction: Math.round(leaveDeduction * 100) / 100,
      },
    });
    slips.push(slip);
  }

  return jsonOk(
    { payroll: serialize(payroll), payslips: serializeMany(slips) },
    "Payroll generated",
    201
  );
}
