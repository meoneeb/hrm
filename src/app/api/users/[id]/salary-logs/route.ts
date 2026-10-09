import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { SalaryLog } from "@/models/SalaryLog";
import {
  requireUser,
  assertOrgAccess,
  canAccessAllOrgs,
  canManageOrgAdmins,
} from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  await dbConnect();
  const target = await User.findById(id);
  if (!target) return jsonErr("Not found", 404);

  if (user!.id !== id) {
    if (target.type === "orgAdmin") {
      if (!canManageOrgAdmins(user!)) return jsonErr("Forbidden", 403);
    } else if (target.orgId) {
      const denied = assertOrgAccess(user!, String(target.orgId));
      if (denied) return denied;
    } else if (!canAccessAllOrgs(user!)) {
      return jsonErr("Forbidden", 403);
    }
  }

  const logs = await SalaryLog.find({ userId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("changedBy", "name email")
    .lean();

  const data = logs.map((log) => {
    const changedBy = log.changedBy as
      | { _id?: unknown; name?: string; email?: string }
      | null;
    return {
      id: String(log._id),
      userId: String(log.userId),
      orgId: log.orgId ? String(log.orgId) : null,
      before: log.before,
      after: log.after,
      deltaBasic: log.deltaBasic,
      createdAt:
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : log.createdAt,
      changedBy: changedBy
        ? {
            id: String(changedBy._id),
            name: changedBy.name || "Unknown",
            email: changedBy.email,
          }
        : null,
    };
  });

  return jsonOk(data);
}
