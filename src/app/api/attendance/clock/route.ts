import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { Org } from "@/models/Org";
import { requireUser } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";
import { resolveEffectiveShift } from "@/lib/org-shift";
import {
  computeLateMinutes,
  getShiftDate,
  isOvernight,
  isWithinClockInWindow,
  resolveOrgTimeZone,
} from "@/lib/shift";

const schema = z.object({
  action: z.enum(["in", "out"]),
  orgId: z.string().optional(),
  eod: z
    .object({
      summary: z.string().min(1),
      blockers: z.string().optional(),
      nextPlan: z.string().optional(),
    })
    .optional(),
});

function resolveClockOrgId(
  user: { type: string; orgId?: string | null; orgIds?: string[] },
  dbUser: { orgId?: unknown; orgIds?: unknown[] } | null,
  requested?: string
) {
  if (requested) return requested;
  if (dbUser?.orgId) return String(dbUser.orgId);
  if (user.orgId) return String(user.orgId);
  const fromDb = (dbUser?.orgIds || []).map(String);
  if (fromDb[0]) return fromDb[0];
  return (user.orgIds || [])[0] || "";
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (
    !["member", "projectManager", "orgAdmin", "superAdmin"].includes(user!.type)
  ) {
    return jsonErr("Forbidden", 403);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400);

  await dbConnect();
  const dbUser = await User.findById(user!.id);
  const orgId = resolveClockOrgId(user!, dbUser, parsed.data.orgId);
  if (!orgId || orgId === "null" || orgId === "undefined") {
    return jsonErr("orgId missing — select an organization", 400);
  }

  const shift = await resolveEffectiveShift(user!.id, orgId);
  if (!shift) return jsonErr("No shift configured for this organization", 400);

  const org = await Org.findById(orgId);
  const timeZone = resolveOrgTimeZone(org?.timezone);

  const now = new Date();
  const shiftDate = getShiftDate(
    now,
    shift.startTime,
    shift.endTime,
    timeZone
  );

  let record = await Attendance.findOne({
    userId: user!.id,
    orgId,
    date: shiftDate,
  });

  if (parsed.data.action === "in") {
    if (record?.clockIn && !record.clockOut) {
      return jsonErr("Already clocked in for this shift", 400);
    }
    if (record?.clockIn && record.clockOut) {
      return jsonErr("Already completed this shift — wait for the next start", 400);
    }

    if (
      !isWithinClockInWindow(
        now,
        shift.startTime,
        shift.endTime,
        shift.graceMinutes ?? 15,
        timeZone
      )
    ) {
      return jsonErr("Shift has not started yet (or has already ended)", 400);
    }

    const openOther = await Attendance.findOne({
      userId: user!.id,
      orgId,
      clockIn: { $ne: null },
      clockOut: null,
    });
    if (openOther) {
      return jsonErr("Clock out of your open shift first", 400);
    }

    const lateMinutes = computeLateMinutes(
      now,
      shiftDate,
      shift.startTime,
      shift.graceMinutes ?? 15,
      timeZone
    );

    if (record) {
      record.clockIn = now;
      record.status = "present";
      record.lateMinutes = lateMinutes;
      await record.save();
    } else {
      record = await Attendance.create({
        userId: user!.id,
        orgId,
        date: shiftDate,
        clockIn: now,
        status: "present",
        lateMinutes,
      });
    }
    return jsonOk(serialize(record), "Clocked in");
  }

  // clock out
  if (!parsed.data.eod?.summary?.trim()) {
    return jsonErr("EOD summary is required to clock out", 400);
  }

  if (!record?.clockIn || record.clockOut) {
    // Overnight post-midnight: open record may be yesterday's shift date
    const open = await Attendance.findOne({
      userId: user!.id,
      orgId,
      clockIn: { $ne: null },
      clockOut: null,
    });
    if (!open) return jsonErr("Clock in first", 400);
    record = open;
  }

  if (record.clockOut) return jsonErr("Already clocked out", 400);
  if (!record.clockIn) return jsonErr("Clock in first", 400);

  record.clockOut = now;
  const worked = Math.max(
    0,
    Math.round((now.getTime() - new Date(record.clockIn).getTime()) / 60000)
  );
  record.workedMinutes = worked;
  if (worked < 240) record.status = "half_day";
  record.eod = {
    summary: parsed.data.eod.summary.trim(),
    blockers: parsed.data.eod.blockers?.trim() || undefined,
    nextPlan: parsed.data.eod.nextPlan?.trim() || undefined,
    submittedAt: now,
  };
  await record.save();
  return jsonOk(
    {
      ...serialize(record),
      overnight: isOvernight(shift.startTime, shift.endTime),
    },
    "Clocked out"
  );
}
