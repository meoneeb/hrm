import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const createSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  managerIds: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await dbConnect();
  const filter: Record<string, unknown> = { orgId };
  if (user!.type === "projectManager") {
    filter._id = { $in: user!.projIds ?? [] };
  }
  const projects = await Project.find(filter).sort({ name: 1 });
  return jsonOk(serializeMany(projects));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  const denied = assertOrgAccess(user!, parsed.data.orgId);
  if (denied) return denied;

  await dbConnect();
  try {
    const project = await Project.create({
      orgId: parsed.data.orgId,
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      managerIds: parsed.data.managerIds ?? [],
    });
    return jsonOk(serialize(project), "Created", 201);
  } catch {
    return jsonErr("Project code may already exist in this org", 409);
  }
}
