import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  managerIds: z.array(z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  await dbConnect();
  const project = await Project.findById(id);
  if (!project) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(project.orgId));
  if (denied) return denied;
  return jsonOk(serialize(project));
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
  const existing = await Project.findById(id);
  if (!existing) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(existing.orgId));
  if (denied) return denied;

  const project = await Project.findByIdAndUpdate(id, parsed.data, { new: true });
  return jsonOk(serialize(project!), "Updated");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }
  const { id } = await ctx.params;
  await dbConnect();
  const existing = await Project.findById(id);
  if (!existing) return jsonErr("Not found", 404);
  const denied = assertOrgAccess(user!, String(existing.orgId));
  if (denied) return denied;
  await Project.findByIdAndDelete(id);
  return jsonOk(null, "Deleted");
}
