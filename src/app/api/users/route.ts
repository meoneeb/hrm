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
  linkedOrgIds,
} from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  type: z.enum(["superAdmin", "orgAdmin", "projectManager", "member"]),
  orgId: z.string().optional().nullable(),
  orgIds: z.array(z.string()).optional(),
  scope: z.enum(["org", "projects"]).optional(),
  projIds: z.array(z.string()).optional(),
  code: z.string().optional(),
  designation: z.string().optional(),
  shiftId: z.string().optional().nullable(),
  salary: z
    .object({
      basic: z.number().optional(),
      allowances: z.number().optional(),
      deductions: z.number().optional(),
    })
    .optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const type = url.searchParams.get("type");
  const primary = url.searchParams.get("primary");

  await dbConnect();
  const filter: Record<string, unknown> = {};

  if (type) filter.type = type;
  if (primary === "true") filter.primary = true;
  if (primary === "false") filter.primary = false;

  if (type === "orgAdmin") {
    if (!canManageOrgAdmins(user!)) {
      return jsonErr("Forbidden", 403);
    }
    // Primary OA only sees orgAdmins that share their orgs
    if (user!.type === "orgAdmin" && user!.primary) {
      const ids = linkedOrgIds(user!);
      filter.orgIds = { $in: ids };
      if (orgId) {
        const denied = assertOrgAccess(user!, orgId);
        if (denied) return denied;
        filter.orgIds = orgId;
      }
    } else if (orgId) {
      filter.orgIds = orgId;
    }
  } else if (orgId) {
    const denied = assertOrgAccess(user!, orgId);
    if (denied) return denied;
    filter.$or = [{ orgId }, { orgIds: orgId }];
    if (user!.type === "projectManager") {
      filter.type = { $in: ["member", "projectManager"] };
      filter.$and = [
        {
          $or: [
            { scope: "org" },
            { projIds: { $in: user!.projIds ?? [] } },
            { _id: user!.id },
          ],
        },
      ];
    }
  } else if (!canAccessAllOrgs(user!)) {
    if (user!.type === "orgAdmin") {
      const ids = linkedOrgIds(user!);
      filter.$or = [{ orgId: { $in: ids } }, { orgIds: { $in: ids } }];
    } else if (user!.orgId) {
      filter.orgId = user!.orgId;
    } else {
      filter._id = user!.id;
    }
  }

  const users = await User.find(filter).sort({ name: 1 });
  return jsonOk(serializeMany(users));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());
  const data = parsed.data;

  if (data.type === "superAdmin" && user!.type !== "superAdmin") {
    return jsonErr("Forbidden", 403);
  }

  // New primary clients must use POST /api/clients
  if (data.type === "orgAdmin") {
    if (!canManageOrgAdmins(user!)) return jsonErr("Forbidden", 403);
    // Secondary orgAdmin only — always primary:false
    const orgIds = data.orgIds?.length
      ? data.orgIds
      : data.orgId
        ? [data.orgId]
        : [];
    if (!orgIds.length) {
      return jsonErr("orgIds required for secondary orgAdmin", 400);
    }
    const deniedIds = assertOrgIdsAllowed(user!, orgIds);
    if (deniedIds) return deniedIds;
  } else if (data.type === "projectManager" || data.type === "member") {
    if (!data.orgId) return jsonErr("orgId required");
    if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
      return jsonErr("Forbidden", 403);
    }
    const denied = assertOrgAccess(user!, data.orgId);
    if (denied) return denied;
  }

  await dbConnect();
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) return jsonErr("Email already in use", 409);

  const passHash = await bcrypt.hash(data.password, 10);

  if (data.type === "orgAdmin") {
    const orgIds = data.orgIds?.length
      ? data.orgIds
      : data.orgId
        ? [data.orgId]
        : [];
    const created = await User.create({
      email: data.email.toLowerCase(),
      passHash,
      name: data.name,
      type: "orgAdmin",
      primary: false,
      orgId: orgIds[0] || null,
      orgIds,
      active: true,
    });
    return jsonOk(serialize(created), "Created", 201);
  }

  const created = await User.create({
    email: data.email.toLowerCase(),
    passHash,
    name: data.name,
    type: data.type,
    primary: false,
    orgId: data.orgId || null,
    orgIds: data.orgIds ?? [],
    scope: data.scope ?? "org",
    projIds: data.projIds ?? [],
    code: data.code,
    designation: data.designation,
    shiftId: data.shiftId || null,
    salary: data.salary ?? { basic: 0, allowances: 0, deductions: 0 },
    joinDate: new Date(),
  });

  return jsonOk(serialize(created), "Created", 201);
}
