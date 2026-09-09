"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useOrgId, useShell } from "@/components/layout/shell-context";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/row-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Dash = Record<string, number | string | null>;
type Attendance = {
  id: string;
  userId: string;
  status: string;
  clockIn?: string | null;
};
type User = { id: string; name: string; designation?: string; type: string };
type Leave = { id: string; status: string; days: number; from: string };

export default function DashboardPage() {
  const { data } = useSession();
  const orgId = useOrgId();
  const shell = useShell();
  const role = data?.user?.type;
  const todayDate = new Date().toISOString().slice(0, 10);
  const staffKey = orgId && role !== "member";

  const { data: stats } = useSWR<Dash>("/api/dashboard");
  const { data: attendance = [] } = useSWR<Attendance[]>(
    staffKey ? `/api/attendance?orgId=${orgId}&date=${todayDate}` : null
  );
  const { data: users = [] } = useSWR<User[]>(
    staffKey ? `/api/users?orgId=${orgId}` : null
  );
  const { data: pendingLeaves = [] } = useSWR<Leave[]>(
    staffKey ? `/api/leaves?orgId=${orgId}&status=pending` : null
  );

  const today = useMemo(() => {
    const map = Object.fromEntries(users.map((x) => [x.id, x]));
    return attendance.slice(0, 8).map((row) => ({ ...row, user: map[row.userId] }));
  }, [attendance, users]);

  const leaves = useMemo(() => pendingLeaves.slice(0, 5), [pendingLeaves]);

  const kpis =
    stats &&
    Object.entries(stats).filter(
      ([k]) => !["role", "primary", "clockIn", "clockOut", "todayStatus"].includes(k)
    );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${data?.user?.name ?? "there"}`}
      />

      {(role === "member" ||
        role === "projectManager" ||
        role === "orgAdmin") && (
        <div className="mb-6">
          <ClockWidget />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis?.map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {key.replace(/([A-Z])/g, " $1")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-teal-400">
                {String(value ?? "—")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {role !== "member" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Today&apos;s attendance</CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-teal-400 hover:bg-transparent hover:text-teal-300 hover:underline"
              >
                <Link href="/dashboard/attendance">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {today.length === 0 ? (
                <p className="text-sm text-gray-500">No punches yet today.</p>
              ) : (
                today.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={row.user?.name || "?"} />
                      <div>
                        <p className="text-sm text-white">
                          {row.user?.name || row.userId}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.user?.designation || row.user?.type}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        row.status === "present"
                          ? "success"
                          : row.status === "leave"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Leave requests</CardTitle>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-teal-400 hover:bg-transparent hover:text-teal-300 hover:underline"
              >
                <Link href="/dashboard/leave">Review</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {leaves.length === 0 ? (
                <p className="text-sm text-gray-500">No pending requests.</p>
              ) : (
                <ul className="space-y-2">
                  {leaves.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-white">
                        {l.from} · {l.days}d
                      </span>
                      <Badge variant="warning">{l.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!stats ? (
        <p className="mt-6 text-sm text-gray-400">Loading metrics…</p>
      ) : null}

      {role === "superAdmin" && !shell.orgId ? (
        <p className="mt-4 text-sm text-gray-500">
          Tip: open Clients to register a new organization + admin.
        </p>
      ) : null}
    </div>
  );
}
