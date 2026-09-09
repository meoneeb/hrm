import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany } from "@/lib/serializers";

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const userId = url.searchParams.get("userId");
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const filter: Record<string, unknown> = {};

  if (user!.type === "member") {
    filter.userId = user!.id;
    if (user!.orgId) filter.orgId = user!.orgId;
  } else {
    if (!orgId) return jsonErr("orgId required");
    const denied = assertOrgAccess(user!, orgId);
    if (denied) return denied;
    filter.orgId = orgId;
    if (userId) filter.userId = userId;
  }

  if (date) filter.date = date;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, string>).$gte = from;
    if (to) (filter.date as Record<string, string>).$lte = to;
  }

  await dbConnect();
  const rows = await Attendance.find(filter).sort({ date: -1 }).limit(500);
  return jsonOk(serializeMany(rows));
}
