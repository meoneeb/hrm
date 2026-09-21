import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

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
  lateMinutes: z.number().optional(),
  workedMinutes: z.number().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

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
  const denied = assertOrgAccess(user!, String(row.orgId));
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
  if (parsed.data.lateMinutes !== undefined) {
    row.lateMinutes = parsed.data.lateMinutes;
  }
  if (parsed.data.clockIn !== undefined) {
    row.clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null;
  }
  if (parsed.data.clockOut !== undefined) {
    row.clockOut = parsed.data.clockOut
      ? new Date(parsed.data.clockOut)
      : null;
  }

  if (parsed.data.workedMinutes !== undefined) {
    row.workedMinutes = Math.max(0, parsed.data.workedMinutes);
  } else if (
    parsed.data.clockIn !== undefined ||
    parsed.data.clockOut !== undefined
  ) {
    if (row.clockIn && row.clockOut) {
      row.workedMinutes = Math.max(
        0,
        Math.round(
          (new Date(row.clockOut).getTime() -
            new Date(row.clockIn).getTime()) /
            60000
        )
      );
    }
  }

  await row.save();
  return jsonOk(serialize(row), "Updated");
}
