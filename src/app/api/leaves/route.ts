import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { dbConnect } from "@/lib/db";
import { Leave } from "@/models/Leave";
import { LeaveType } from "@/models/LeaveType";
import { User } from "@/models/User";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const applySchema = z.object({
  typeId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().optional(),
  orgId: z.string().optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") || user!.orgId;
  const status = url.searchParams.get("status");

  const filter: Record<string, unknown> = {};
  if (user!.type === "member") {
    filter.userId = user!.id;
  } else {
    if (!orgId) return jsonErr("orgId required");
    const denied = assertOrgAccess(user!, orgId);
    if (denied) return denied;
    filter.orgId = orgId;
  }
  if (status) filter.status = status;

  await dbConnect();
  const rows = await Leave.find(filter).sort({ createdAt: -1 }).limit(200);
  return jsonOk(serializeMany(rows));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = applySchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  await dbConnect();
  const dbUser = await User.findById(user!.id);
  const orgId = parsed.data.orgId || String(dbUser?.orgId || user!.orgId || "");
  if (!orgId) return jsonErr("orgId required");

  if (user!.type !== "member" && user!.type !== "projectManager") {
    if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
      return jsonErr("Forbidden", 403);
    }
  }

  const days =
    differenceInCalendarDays(parseISO(parsed.data.to), parseISO(parsed.data.from)) + 1;
  if (days < 1) return jsonErr("Invalid date range");

  const leaveType = await LeaveType.findById(parsed.data.typeId);
  if (!leaveType) return jsonErr("Leave type not found", 404);

  const leave = await Leave.create({
    userId: user!.id,
    orgId,
    typeId: parsed.data.typeId,
    from: parsed.data.from,
    to: parsed.data.to,
    days,
    reason: parsed.data.reason,
    status: "pending",
  });

  return jsonOk(serialize(leave), "Applied", 201);
}
