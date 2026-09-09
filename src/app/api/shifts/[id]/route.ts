import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  name: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  graceMinutes: z.number().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

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
  const denied = assertOrgAccess(user!, String(existing.orgId));
  if (denied) return denied;
  await Shift.findByIdAndDelete(id);
  return jsonOk(null, "Deleted");
}
