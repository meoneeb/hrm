import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  await dbConnect();
  const rows = await Attendance.find({
    orgId,
    date: { $regex: `^${prefix}` },
  });

  const summary = {
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
    total: rows.length,
    month,
    year,
  };
  for (const row of rows) {
    summary[row.status] = (summary[row.status] || 0) + 1;
  }

  return jsonOk(summary);
}
