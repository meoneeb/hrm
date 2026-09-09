import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { LeaveType } from "@/models/LeaveType";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const createSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  defaultCredits: z.number().optional(),
  paid: z.boolean().optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const orgId = new URL(req.url).searchParams.get("orgId") || user!.orgId;
  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await dbConnect();
  const types = await LeaveType.find({ orgId }).sort({ name: 1 });
  return jsonOk(serializeMany(types));
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
  const row = await LeaveType.create(parsed.data);
  return jsonOk(serialize(row), "Created", 201);
}
