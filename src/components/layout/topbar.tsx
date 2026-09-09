"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/layout/shell-context";
import { formatDate } from "@/lib/datetime";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/admins": "Clients",
  "/dashboard/orgs": "Organizations",
  "/dashboard/projects": "Projects",
  "/dashboard/members": "Members",
  "/dashboard/attendance": "Attendance",
  "/dashboard/leave": "Leave",
  "/dashboard/payroll": "Payroll",
  "/dashboard/reports": "Reports",
};

export function Topbar() {
  const pathname = usePathname();
  const {
    user,
    orgs,
    projects,
    orgId,
    setOrgId,
    projId,
    setProjId,
    setMobileOpen,
  } = useShell();

  const title =
    Object.entries(TITLES).find(
      ([path]) =>
        path === "/dashboard"
          ? pathname === path
          : pathname.startsWith(path)
    )?.[1] || "Dashboard";

  const dateLabel = formatDate(new Date());

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-white/5 bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-lg font-semibold text-white md:hidden">
          {title}
        </h1>
        {user.type !== "member" && orgs.length > 0 ? (
          <div className="hidden items-center gap-2 sm:flex">
            <Select
              className="w-44 md:w-52"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">Select org</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </Select>
            <Select
              className="w-40 md:w-48"
              value={projId}
              onChange={(e) => setProjId(e.target.value)}
              disabled={!orgId}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <p className="shrink-0 text-sm text-gray-400">{dateLabel}</p>
    </header>
  );
}

export { useOrgId } from "@/components/layout/shell-context";
