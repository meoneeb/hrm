import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Holiday } from "@/models/Holiday";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize, serializeMany } from "@/lib/serializers";

const createSchema = z.object({
  orgId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().optional(),
});

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  const filter: Record<string, unknown> = { orgId };
  if (year && month) {
    const prefix = `${year}-${String(Number(month)).padStart(2, "0")}`;
    filter.date = { $regex: `^${prefix}` };
  } else if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, string>).$gte = from;
    if (to) (filter.date as Record<string, string>).$lte = to;
  }

  await dbConnect();
  const rows = await Holiday.find(filter).sort({ date: 1 });
  return jsonOk(serializeMany(rows));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonErr("Invalid body", 400, parsed.error.flatten());
  }
  const denied = assertOrgAccess(user!, parsed.data.orgId);
  if (denied) return denied;

  await dbConnect();
  try {
    const row = await Holiday.create({
      orgId: parsed.data.orgId,
      date: parsed.data.date,
      name: parsed.data.name?.trim() || undefined,
    });
    return jsonOk(serialize(row), "Created", 201);
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 11000) return jsonErr("Holiday already exists for that date", 409);
    throw e;
  }
}
