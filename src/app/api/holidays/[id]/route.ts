import { dbConnect } from "@/lib/db";
import { Holiday } from "@/models/Holiday";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }

  const { id } = await ctx.params;
  await dbConnect();
  const existing = await Holiday.findById(id);
  if (!existing) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(existing.orgId));
  if (denied) return denied;

  await Holiday.findByIdAndDelete(id);
  return jsonOk(null, "Deleted");
}
