import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { requireUser, linkedOrgIds } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";
import { Org } from "@/models/Org";
import { resolveEffectiveShift } from "@/lib/org-shift";
import {
  getShiftDate,
  isOvernight,
  isWithinClockInWindow,
  resolveOrgTimeZone,
} from "@/lib/shift";

function shiftLabel(start: string, end: string) {
  return isOvernight(start, end)
    ? `${start} – ${end} (+1 day)`
    : `${start} – ${end}`;
}

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const requestedOrg = url.searchParams.get("orgId") || undefined;

  await dbConnect();
  const dbUser = await User.findById(user!.id);
  let orgId =
    requestedOrg ||
    (dbUser?.orgId ? String(dbUser.orgId) : "") ||
    user!.orgId ||
    "";
  if (!orgId) {
    const linked = linkedOrgIds(user!);
    orgId = linked[0] || "";
  }
  if (!orgId) return jsonErr("orgId missing — select an organization", 400);

  const shift = await resolveEffectiveShift(user!.id, orgId);
  if (!shift) {
    return jsonOk({
      orgId,
      shift: null,
      shiftDate: null,
      attendance: null,
      canClockIn: false,
      canClockOut: false,
    });
  }

  const org = await Org.findById(orgId);
  const timeZone = resolveOrgTimeZone(org?.timezone);

  const now = new Date();
  const shiftDate = getShiftDate(
    now,
    shift.startTime,
    shift.endTime,
    timeZone
  );
  let attendance = await Attendance.findOne({
    userId: user!.id,
    orgId,
    date: shiftDate,
  });

  if (!attendance?.clockIn) {
    const open = await Attendance.findOne({
      userId: user!.id,
      orgId,
      clockIn: { $ne: null },
      clockOut: null,
    });
    if (open) attendance = open;
  }

  const openSession = !!(attendance?.clockIn && !attendance?.clockOut);
  const completedThisShift = !!(
    attendance?.clockIn &&
    attendance?.clockOut &&
    attendance.date === shiftDate
  );
  const inWindow = isWithinClockInWindow(
    now,
    shift.startTime,
    shift.endTime,
    shift.graceMinutes ?? 15,
    timeZone
  );

  return jsonOk({
    orgId,
    shift: {
      id: String(shift._id),
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.graceMinutes,
      overnight: isOvernight(shift.startTime, shift.endTime),
      label: shiftLabel(shift.startTime, shift.endTime),
    },
    shiftDate,
    timeZone,
    attendance: attendance ? serialize(attendance) : null,
    canClockIn: inWindow && !openSession && !completedThisShift,
    canClockOut: openSession,
  });
}
