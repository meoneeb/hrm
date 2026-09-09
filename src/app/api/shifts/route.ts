import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";

const createSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  graceMinutes: z.number().optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  await dbConnect();
  const shifts = await Shift.find({ orgId }).sort({ name: 1 });
  return jsonOk(serializeMany(shifts));
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
  const shift = await Shift.create(parsed.data);
  const { Org } = await import("@/models/Org");
  const org = await Org.findById(parsed.data.orgId);
  if (org && !org.defaultShiftId) {
    org.defaultShiftId = shift._id as never;
    await org.save();
  }
  return jsonOk(serialize(shift), "Created", 201);
}
