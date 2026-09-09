import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Org } from "@/models/Org";
import { User } from "@/models/User";
import { requireUser } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";
import { ensureOrgDefaultShift } from "@/lib/org-shift";

const schema = z.object({
  org: z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    timezone: z.string().optional(),
    currency: z.string().optional(),
    secondaryCurrency: z.string().nullable().optional(),
    fxRate: z.number().positive().optional(),
  }),
  admin: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

/**
 * Client onboarding: creates ORG + primary orgAdmin (OA1) linked to that org.
 * Only superAdmin (or an existing primary) may call this.
 * New client admin is always primary:true with orgIds=[ORG].
 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  // Only platform superAdmin registers new clients (new primary OA + org)
  if (user!.type !== "superAdmin") {
    return jsonErr("Only superAdmin can register a new client", 403);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400, parsed.error.flatten());

  await dbConnect();
  const code = parsed.data.org.code.toUpperCase();
  if (await Org.findOne({ code })) {
    return jsonErr("Org code already exists", 409);
  }
  const email = parsed.data.admin.email.toLowerCase();
  if (await User.findOne({ email })) {
    return jsonErr("Admin email already in use", 409);
  }

  const org = await Org.create({
    name: parsed.data.org.name,
    code,
    timezone: parsed.data.org.timezone || "Asia/Karachi",
    currency: (parsed.data.org.currency || "PKR").toUpperCase(),
    secondaryCurrency: parsed.data.org.secondaryCurrency
      ? parsed.data.org.secondaryCurrency.toUpperCase()
      : null,
    fxRate: parsed.data.org.fxRate ?? 1,
    createdBy: user!.id,
  });

  const passHash = await bcrypt.hash(parsed.data.admin.password, 10);

  const admin = await User.create({
    email,
    passHash,
    name: parsed.data.admin.name,
    type: "orgAdmin",
    primary: true,
    orgId: org._id,
    orgIds: [org._id],
    active: true,
  });

  await ensureOrgDefaultShift(org._id);
  const refreshed = await Org.findById(org._id);

  return jsonOk(
    { org: serialize(refreshed || org), admin: serialize(admin) },
    "Client registered",
    201
  );
}
