import { auth } from "@/lib/auth";
import type { SessionUser, UserType } from "@/types";
import { jsonErr } from "@/lib/utils";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null as SessionUser | null, error: jsonErr("Unauthorized", 401) };
  }
  return { user, error: null as Response | null };
}

export function requireType(user: SessionUser, types: UserType[]) {
  if (!types.includes(user.type)) {
    return jsonErr("Forbidden", 403);
  }
  return null;
}

/** Only superAdmin sees every organization. */
export function canAccessAllOrgs(user: SessionUser) {
  return user.type === "superAdmin";
}

export function linkedOrgIds(user: SessionUser): string[] {
  if (user.type === "orgAdmin") return user.orgIds ?? [];
  if (user.orgId) return [user.orgId];
  return [];
}

export function canAccessOrg(user: SessionUser, orgId: string) {
  if (canAccessAllOrgs(user)) return true;
  return linkedOrgIds(user).includes(orgId);
}

export function assertOrgAccess(user: SessionUser, orgId: string) {
  if (!canAccessOrg(user, orgId)) {
    return jsonErr("No access to this org", 403);
  }
  return null;
}

/** SuperAdmin or primary orgAdmin can onboard clients / create secondary admins. */
export function canManageOrgAdmins(user: SessionUser) {
  return user.type === "superAdmin" || (user.type === "orgAdmin" && user.primary);
}

/** OrgAdmin may only assign orgIds they themselves are linked to. */
export function assertOrgIdsAllowed(user: SessionUser, orgIds: string[]) {
  if (canAccessAllOrgs(user)) return null;
  const allowed = new Set(linkedOrgIds(user));
  for (const id of orgIds) {
    if (!allowed.has(id)) {
      return jsonErr("Cannot assign an organization you do not manage", 403);
    }
  }
  return null;
}

export function canRunPayroll(user: SessionUser) {
  return user.type === "superAdmin" || user.type === "orgAdmin";
}

export function canApproveLeave(user: SessionUser) {
  return (
    user.type === "superAdmin" ||
    user.type === "orgAdmin" ||
    user.type === "projectManager"
  );
}

export function accessibleOrgFilter(user: SessionUser) {
  if (canAccessAllOrgs(user)) return {};
  const ids = linkedOrgIds(user);
  if (ids.length) return { _id: { $in: ids } };
  return { _id: null };
}
