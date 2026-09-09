import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  status: z.enum(["present", "absent", "half_day", "leave", "holiday"]).optional(),
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
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin" && user!.type !== "projectManager") {
    return jsonErr("Forbidden", 403);
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  await dbConnect();
  const row = await Attendance.findById(id);
  if (!row) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(row.orgId));
  if (denied) return denied;

  if (parsed.data.status !== undefined) row.status = parsed.data.status;
  if (parsed.data.note !== undefined) row.note = parsed.data.note;
  if (parsed.data.lateMinutes !== undefined) row.lateMinutes = parsed.data.lateMinutes;
  if (parsed.data.workedMinutes !== undefined) row.workedMinutes = parsed.data.workedMinutes;
  if (parsed.data.clockIn !== undefined) {
    row.clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null;
  }
  if (parsed.data.clockOut !== undefined) {
    row.clockOut = parsed.data.clockOut ? new Date(parsed.data.clockOut) : null;
  }
  await row.save();
  return jsonOk(serialize(row), "Updated");
}
