"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
  UserCog,
  Clock,
  CalendarDays,
  Wallet,
  BarChart3,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { UserType } from "@/types";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/row-actions";
import { BrandLockup } from "@/components/brand";
import { useShell } from "@/components/layout/shell-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  types: UserType[];
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    types: ["superAdmin", "orgAdmin", "projectManager", "member"],
  },
  {
    href: "/dashboard/admins",
    label: "Clients",
    icon: UserCog,
    types: ["superAdmin", "orgAdmin"],
  },
  {
    href: "/dashboard/orgs",
    label: "Organizations",
    icon: Building2,
    types: ["superAdmin", "orgAdmin"],
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    icon: FolderKanban,
    types: ["superAdmin", "orgAdmin", "projectManager"],
  },
  {
    href: "/dashboard/members",
    label: "Members",
    icon: Users,
    types: ["superAdmin", "orgAdmin", "projectManager"],
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
    icon: Clock,
    types: ["superAdmin", "orgAdmin", "projectManager", "member"],
  },
  {
    href: "/dashboard/leave",
    label: "Leave",
    icon: CalendarDays,
    types: ["superAdmin", "orgAdmin", "projectManager", "member"],
  },
  {
    href: "/dashboard/payroll",
    label: "Payroll",
    icon: Wallet,
    types: ["superAdmin", "orgAdmin", "member"],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    types: ["superAdmin", "orgAdmin", "projectManager"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    user,
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
  } = useShell();

  const items = NAV.filter((item) => {
    if (!item.types.includes(user.type)) return false;
    if (item.href === "/dashboard/admins" && user.type === "orgAdmin" && !user.primary) {
      return false;
    }
    return true;
  });

  const body = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/5 bg-sidebar transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/5 px-3 py-4">
        <BrandLockup compact={collapsed} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-[var(--sidebar-active)] text-teal-400"
                  : "text-gray-400 hover:bg-muted hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-white/5 p-3">
        <Button
          type="button"
          variant="ghost"
          className="hidden w-full justify-center text-gray-400 hover:bg-muted hover:text-white md:flex"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              Collapse
            </>
          )}
        </Button>

        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-muted/50 p-2",
            collapsed && "justify-center"
          )}
        >
          <InitialsAvatar name={user.name} />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.type}</p>
            </div>
          ) : null}
        </div>

        <Button
          variant="ghost"
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign out" : null}
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-screen sticky top-0 md:flex">{body}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <Button
            type="button"
            variant="ghost"
            aria-label="Close menu"
            className="absolute inset-0 h-auto w-auto rounded-none bg-black/60 p-0 hover:bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">{body}</div>
        </div>
      ) : null}
    </>
  );
}
