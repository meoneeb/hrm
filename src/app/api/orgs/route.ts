import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Org } from "@/models/Org";
import { User } from "@/models/User";
import { requireUser, accessibleOrgFilter } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany, serialize } from "@/lib/serializers";
import { ensureOrgDefaultShift } from "@/lib/org-shift";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  secondaryCurrency: z.string().nullable().optional(),
  fxRate: z.number().positive().optional(),
});

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await dbConnect();
  const filter = accessibleOrgFilter(user!);
  const orgs = await Org.find(filter).sort({ name: 1 });
  return jsonOk(serializeMany(orgs));
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user!.type !== "superAdmin" && user!.type !== "orgAdmin") {
    return jsonErr("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  await dbConnect();
  const exists = await Org.findOne({ code: parsed.data.code.toUpperCase() });
  if (exists) return jsonErr("Org code already exists", 409);

  const org = await Org.create({
    name: parsed.data.name,
    code: parsed.data.code.toUpperCase(),
    timezone: parsed.data.timezone || "Asia/Karachi",
    currency: (parsed.data.currency || "PKR").toUpperCase(),
    secondaryCurrency: parsed.data.secondaryCurrency
      ? parsed.data.secondaryCurrency.toUpperCase()
      : null,
    fxRate: parsed.data.fxRate ?? 1,
    createdBy: user!.id,
  });

  if (user!.type === "orgAdmin") {
    await User.findByIdAndUpdate(user!.id, {
      $addToSet: { orgIds: org._id },
      $set: { orgId: user!.orgId || org._id },
    });
  }

  await ensureOrgDefaultShift(org._id);
  const refreshed = await Org.findById(org._id);
  return jsonOk(serialize(refreshed || org), "Created", 201);
}
