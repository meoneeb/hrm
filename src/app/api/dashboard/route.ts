import { dbConnect } from "@/lib/db";
import { Org } from "@/models/Org";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { Leave } from "@/models/Leave";
import { Payroll } from "@/models/Payroll";
import {
  requireUser,
  accessibleOrgFilter,
} from "@/lib/rbac";
import { jsonOk, toDateKey } from "@/lib/utils";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await dbConnect();
  const today = toDateKey(new Date());

  if (user!.type === "superAdmin" || (user!.type === "orgAdmin" && user!.primary)) {
    const [orgs, members, pendingLeaves, payrolls] = await Promise.all([
      Org.countDocuments(),
      User.countDocuments({ type: { $in: ["member", "projectManager"] } }),
      Leave.countDocuments({ status: "pending" }),
      Payroll.countDocuments(),
    ]);
    const presentToday = await Attendance.countDocuments({
      date: today,
      status: { $in: ["present", "half_day"] },
    });
    return jsonOk({
      role: user!.type,
      primary: user!.primary,
      orgs,
      members,
      pendingLeaves,
      payrolls,
      presentToday,
    });
  }

  if (user!.type === "orgAdmin") {
    const orgFilter = accessibleOrgFilter(user!);
    const orgs = await Org.find(orgFilter);
    const orgIds = orgs.map((o) => o._id);
    const [members, projects, pendingLeaves, presentToday] = await Promise.all([
      User.countDocuments({
        orgId: { $in: orgIds },
        type: { $in: ["member", "projectManager"] },
      }),
      Project.countDocuments({ orgId: { $in: orgIds } }),
      Leave.countDocuments({ orgId: { $in: orgIds }, status: "pending" }),
      Attendance.countDocuments({
        orgId: { $in: orgIds },
        date: today,
        status: { $in: ["present", "half_day"] },
      }),
    ]);
    return jsonOk({
      role: user!.type,
      primary: false,
      orgs: orgs.length,
      members,
      projects,
      pendingLeaves,
      presentToday,
    });
  }

  if (user!.type === "projectManager") {
    const orgId = user!.orgId;
    const [team, pendingLeaves, presentToday] = await Promise.all([
      User.countDocuments({
        orgId,
        type: "member",
        $or: [{ scope: "org" }, { projIds: { $in: user!.projIds ?? [] } }],
      }),
      Leave.countDocuments({ orgId, status: "pending" }),
      Attendance.countDocuments({
        orgId,
        date: today,
        status: { $in: ["present", "half_day"] },
      }),
    ]);
    return jsonOk({
      role: user!.type,
      projects: (user!.projIds ?? []).length,
      team,
      pendingLeaves,
      presentToday,
    });
  }

  const myAttendance = await Attendance.findOne({
    userId: user!.id,
    date: today,
  });
  const dbUser = await User.findById(user!.id);
  const pendingLeaves = await Leave.countDocuments({
    userId: user!.id,
    status: "pending",
  });

  return jsonOk({
    role: user!.type,
    todayStatus: myAttendance?.status ?? "absent",
    clockIn: myAttendance?.clockIn ?? null,
    clockOut: myAttendance?.clockOut ?? null,
    leaveCredits: (dbUser?.credits ?? []).reduce(
      (s: number, c: { balance: number }) => s + c.balance,
      0
    ),
    pendingLeaves,
  });
}
