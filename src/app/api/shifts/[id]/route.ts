import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { Org } from "@/models/Org";
import { User } from "@/models/User";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";
import { ensureOrgDefaultShift } from "@/lib/org-shift";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  graceMinutes: z.number().min(0).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  await dbConnect();
  const shift = await Shift.findById(id);
  if (!shift) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(shift.orgId));
  if (denied) return denied;
  return jsonOk(serialize(shift));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  await dbConnect();
  const existing = await Shift.findById(id);
  if (!existing) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(existing.orgId));
  if (denied) return denied;

  const shift = await Shift.findByIdAndUpdate(id, parsed.data, { new: true });
  return jsonOk(serialize(shift!), "Updated");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }
  const { id } = await ctx.params;
  await dbConnect();
  const existing = await Shift.findById(id);
  if (!existing) return jsonErr("Not found", 404);
  const orgId = String(existing.orgId);
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await User.updateMany({ shiftId: existing._id }, { $set: { shiftId: null } });

  const org = await Org.findById(orgId);
  const wasDefault =
    org?.defaultShiftId && String(org.defaultShiftId) === id;

  await Shift.findByIdAndDelete(id);

  if (wasDefault && org) {
    const next = await Shift.findOne({ orgId: org._id }).sort({ name: 1 });
    org.defaultShiftId = next ? (next._id as never) : null;
    await org.save();
    if (!next) await ensureOrgDefaultShift(orgId);
  }

  return jsonOk(null, "Deleted");
}
