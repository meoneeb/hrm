import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Org } from "@/models/Org";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize, serializeMany } from "@/lib/serializers";
import { resolveEffectiveShift } from "@/lib/org-shift";
import {
  computeLateMinutes,
  resolveOrgTimeZone,
} from "@/lib/shift";

const statusEnum = z.enum([
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
]);

const createSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: statusEnum.optional(),
  clockIn: z.string().nullable().optional(),
  clockOut: z.string().nullable().optional(),
  note: z.string().optional(),
});

function canManageAttendance(type: string) {
  return (
    type === "superAdmin" || type === "orgAdmin" || type === "projectManager"
  );
}

function workedFromClocks(
  clockIn: Date | null | undefined,
  clockOut: Date | null | undefined
) {
  if (!clockIn || !clockOut) return 0;
  return Math.max(
    0,
    Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
  );
}

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const userId = url.searchParams.get("userId");
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const filter: Record<string, unknown> = {};

  if (user!.type === "member") {
    filter.userId = user!.id;
    if (user!.orgId) filter.orgId = user!.orgId;
  } else {
    if (!orgId) return jsonErr("orgId required");
    const denied = assertOrgAccess(user!, orgId);
    if (denied) return denied;
    filter.orgId = orgId;
    if (userId) filter.userId = userId;
  }

  if (date) filter.date = date;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, string>).$gte = from;
    if (to) (filter.date as Record<string, string>).$lte = to;
  }

  await dbConnect();
  const rows = await Attendance.find(filter).sort({ date: -1 }).limit(500);
  return jsonOk(serializeMany(rows));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!canManageAttendance(user!.type)) return jsonErr("Forbidden", 403);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonErr("Invalid body", 400, parsed.error.flatten());
  }

  const denied = assertOrgAccess(user!, parsed.data.orgId);
  if (denied) return denied;

  await dbConnect();
  const member = await User.findById(parsed.data.userId);
  if (!member) return jsonErr("User not found", 404);

  const clockIn = parsed.data.clockIn
    ? new Date(parsed.data.clockIn)
    : null;
  const clockOut = parsed.data.clockOut
    ? new Date(parsed.data.clockOut)
    : null;
  if (clockIn && Number.isNaN(clockIn.getTime())) {
    return jsonErr("Invalid clockIn", 400);
  }
  if (clockOut && Number.isNaN(clockOut.getTime())) {
    return jsonErr("Invalid clockOut", 400);
  }

  const workedMinutes = workedFromClocks(clockIn, clockOut);
  let lateMinutes = 0;
  if (clockIn) {
    const shift = await resolveEffectiveShift(
      parsed.data.userId,
      parsed.data.orgId
    );
    const org = await Org.findById(parsed.data.orgId);
    const timeZone = resolveOrgTimeZone(org?.timezone);
    lateMinutes = shift
      ? computeLateMinutes(
          clockIn,
          parsed.data.date,
          shift.startTime,
          shift.graceMinutes ?? 15,
          timeZone
        )
      : 0;
  }

  const set = {
    userId: parsed.data.userId,
    orgId: parsed.data.orgId,
    date: parsed.data.date,
    status: parsed.data.status || "present",
    clockIn,
    clockOut,
    lateMinutes,
    workedMinutes,
    note: parsed.data.note,
  };

  const row = await Attendance.findOneAndUpdate(
    {
      userId: parsed.data.userId,
      orgId: parsed.data.orgId,
      date: parsed.data.date,
    },
    { $set: set },
    { upsert: true, new: true }
  );

  return jsonOk(serialize(row!), "Saved", 201);
}
