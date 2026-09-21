import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { Org } from "@/models/Org";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";
import { resolveEffectiveShift } from "@/lib/org-shift";
import {
  computeLateMinutes,
  resolveOrgTimeZone,
} from "@/lib/shift";

const patchSchema = z.object({
  status: z
    .enum(["present", "absent", "half_day", "leave", "holiday"])
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  clockIn: z.string().nullable().optional(),
  clockOut: z.string().nullable().optional(),
  note: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

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

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (
    user!.type !== "superAdmin" &&
    user!.type !== "orgAdmin" &&
    user!.type !== "projectManager"
  ) {
    return jsonErr("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonErr("Invalid body", 400, parsed.error.flatten());
  }

  await dbConnect();
  const row = await Attendance.findById(id);
  if (!row) return jsonErr("Not found", 404);
  const orgId = String(row.orgId);
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  if (parsed.data.date !== undefined && parsed.data.date !== row.date) {
    const clash = await Attendance.findOne({
      userId: row.userId,
      orgId: row.orgId,
      date: parsed.data.date,
      _id: { $ne: row._id },
    });
    if (clash) {
      return jsonErr("Attendance already exists for that date", 409);
    }
    row.date = parsed.data.date;
  }

  if (parsed.data.status !== undefined) row.status = parsed.data.status;
  if (parsed.data.note !== undefined) row.note = parsed.data.note;
  if (parsed.data.clockIn !== undefined) {
    row.clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null;
  }
  if (parsed.data.clockOut !== undefined) {
    row.clockOut = parsed.data.clockOut
      ? new Date(parsed.data.clockOut)
      : null;
  }

  row.workedMinutes = workedFromClocks(row.clockIn, row.clockOut);

  if (row.clockIn) {
    const shift = await resolveEffectiveShift(String(row.userId), orgId);
    const org = await Org.findById(orgId);
    const timeZone = resolveOrgTimeZone(org?.timezone);
    // computeLateMinutes uses shiftDate + startTime vs "now" as clock-in instant
    row.lateMinutes = shift
      ? computeLateMinutes(
          new Date(row.clockIn),
          row.date,
          shift.startTime,
          shift.graceMinutes ?? 15,
          timeZone
        )
      : 0;
  } else {
    row.lateMinutes = 0;
  }

  await row.save();
  return jsonOk(serialize(row), "Updated");
}
