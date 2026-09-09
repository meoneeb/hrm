import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import {
  requireUser,
  assertOrgAccess,
  assertOrgIdsAllowed,
  canManageOrgAdmins,
  canAccessAllOrgs,
} from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  orgId: z.string().nullable().optional(),
  orgIds: z.array(z.string()).optional(),
  scope: z.enum(["org", "projects"]).optional(),
  projIds: z.array(z.string()).optional(),
  code: z.string().optional(),
  designation: z.string().optional(),
  shiftId: z.string().nullable().optional(),
  salary: z
    .object({
      basic: z.number().optional(),
      allowances: z.number().optional(),
      deductions: z.number().optional(),
    })
    .optional(),
  credits: z
    .array(z.object({ typeId: z.string(), balance: z.number() }))
    .optional(),
  password: z.string().min(6).optional(),
  transferPrimary: z.boolean().optional(),
  type: z.enum(["orgAdmin", "projectManager", "member"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  await dbConnect();
  const target = await User.findById(id);
  if (!target) return jsonErr("Not found", 404);

  if (user!.id !== id) {
    if (target.type === "orgAdmin") {
      if (!canManageOrgAdmins(user!)) return jsonErr("Forbidden", 403);
    } else if (target.orgId) {
      const denied = assertOrgAccess(user!, String(target.orgId));
      if (denied) return denied;
    } else if (!canAccessAllOrgs(user!)) {
      return jsonErr("Forbidden", 403);
    }
  }

  return jsonOk(serialize(target));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());
  const data = parsed.data;

  await dbConnect();
  const target = await User.findById(id);
  if (!target) return jsonErr("Not found", 404);

  if (data.transferPrimary) {
    if (user!.type !== "superAdmin" && !(user!.type === "orgAdmin" && user!.primary)) {
      return jsonErr("Forbidden", 403);
    }
    if (target.type !== "orgAdmin") return jsonErr("Target must be orgAdmin");
    // Promote within shared orgs — do not demote other clients' primaries
    target.primary = true;
    if (!(target.orgIds?.length) && target.orgId) {
      target.orgIds = [target.orgId] as never;
    }
    await target.save();
    return jsonOk(serialize(target), "Promoted to primary");
  }

  if (data.orgIds !== undefined) {
    const deniedIds = assertOrgIdsAllowed(user!, data.orgIds);
    if (deniedIds && user!.type !== "superAdmin") return deniedIds;
  }

  if (target.type === "orgAdmin") {
    if (!canManageOrgAdmins(user!)) return jsonErr("Forbidden", 403);
    if (target.primary && user!.id === id && data.active === false) {
      return jsonErr("Primary cannot deactivate themselves", 400);
    }
  } else if (user!.id !== id) {
    if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
      return jsonErr("Forbidden", 403);
    }
    if (target.orgId) {
      const denied = assertOrgAccess(user!, String(target.orgId));
      if (denied) return denied;
    }
  }

  if (data.password) {
    target.passHash = await bcrypt.hash(data.password, 10);
  }
  if (data.name !== undefined) target.name = data.name;
  if (data.active !== undefined) target.active = data.active;
  if (data.orgId !== undefined) target.orgId = data.orgId as never;
  if (data.orgIds !== undefined) target.orgIds = data.orgIds as never;
  if (data.scope !== undefined) target.scope = data.scope;
  if (data.projIds !== undefined) target.projIds = data.projIds as never;
  if (data.code !== undefined) target.code = data.code;
  if (data.designation !== undefined) target.designation = data.designation;
  if (data.shiftId !== undefined) target.shiftId = data.shiftId as never;
  if (data.salary !== undefined) {
    target.salary = { ...target.salary, ...data.salary };
  }
  if (data.credits !== undefined) {
    if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
      return jsonErr("Only orgAdmin can update leave credits", 403);
    }
    if (target.orgId) {
      const denied = assertOrgAccess(user!, String(target.orgId));
      if (denied) return denied;
    }
    target.credits = data.credits as never;
  }
  if (data.type !== undefined && !target.primary) target.type = data.type;

  await target.save();
  return jsonOk(serialize(target), "Updated");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  await dbConnect();
  const target = await User.findById(id);
  if (!target) return jsonErr("Not found", 404);

  if (target.primary && target.type === "orgAdmin") {
    return jsonErr("Transfer primary before deleting", 400);
  }

  if (target.type === "orgAdmin") {
    if (!canManageOrgAdmins(user!)) return jsonErr("Forbidden", 403);
  } else {
    if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
      return jsonErr("Forbidden", 403);
    }
    if (target.orgId) {
      const denied = assertOrgAccess(user!, String(target.orgId));
      if (denied) return denied;
    }
  }

  await User.findByIdAndDelete(id);
  return jsonOk(null, "Deleted");
}
