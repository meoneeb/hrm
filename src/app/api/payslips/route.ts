import { dbConnect } from "@/lib/db";
import { Payslip } from "@/models/Payslip";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serializeMany } from "@/lib/serializers";

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") || user!.orgId;
  const payrollId = url.searchParams.get("payrollId");

  const filter: Record<string, unknown> = {};
  if (user!.type === "member" || user!.type === "projectManager") {
    filter.userId = user!.id;
    if (user!.orgId) filter.orgId = user!.orgId;
  } else {
    if (!orgId) return jsonErr("orgId required");
    const denied = assertOrgAccess(user!, orgId);
    if (denied) return denied;
    filter.orgId = orgId;
  }
  if (payrollId) filter.payrollId = payrollId;

  await dbConnect();
  const rows = await Payslip.find(filter).sort({ createdAt: -1 }).limit(200);
  return jsonOk(serializeMany(rows));
}
