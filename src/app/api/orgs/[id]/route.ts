import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Org } from "@/models/Org";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  currency: z.string().optional(),
  secondaryCurrency: z.string().nullable().optional(),
  fxRate: z.number().positive().optional(),
  defaultShiftId: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const denied = assertOrgAccess(user!, id);
  if (denied) return denied;

  await dbConnect();
  const org = await Org.findById(id);
  if (!org) return jsonErr("Not found", 404);
  return jsonOk(serialize(org));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const denied = assertOrgAccess(user!, id);
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  const data = { ...parsed.data };
  if (data.currency) data.currency = data.currency.toUpperCase();
  if (typeof data.secondaryCurrency === "string") {
    data.secondaryCurrency = data.secondaryCurrency.toUpperCase();
  }

  await dbConnect();
  const org = await Org.findByIdAndUpdate(id, data, { new: true });
  if (!org) return jsonErr("Not found", 404);
  return jsonOk(serialize(org), "Updated");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && !(user!.type === "orgAdmin" && user!.primary)) {
    return jsonErr("Forbidden", 403);
  }
  const { id } = await ctx.params;
  const denied = assertOrgAccess(user!, id);
  if (denied) return denied;

  await dbConnect();
  const org = await Org.findByIdAndUpdate(
    id,
    { status: "inactive" },
    { new: true }
  );
  if (!org) return jsonErr("Not found", 404);
  return jsonOk(serialize(org), "Deactivated");
}
