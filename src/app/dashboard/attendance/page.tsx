"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId } from "@/components/layout/shell-context";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { PageHeader, EmptyState, Select } from "@/components/ui/misc";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/row-actions";
import { formatDateKey, formatDateTime, formatTime } from "@/lib/datetime";

type Eod = {
  summary?: string;
  blockers?: string;
  nextPlan?: string;
  submittedAt?: string;
};

type Row = {
  id: string;
  date: string;
  status: string;
  clockIn?: string | null;
  clockOut?: string | null;
  lateMinutes: number;
  workedMinutes: number;
  userId: string;
  eod?: Eod | null;
  user?: User;
};

type User = { id: string; name: string; designation?: string; type: string };

export default function AttendancePage() {
  const { data: session } = useSession();
  const orgId = useOrgId();
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);
  const [viewEod, setViewEod] = useState<Row | null>(null);
  const isMember = session?.user?.type === "member";
  const canClock =
    session?.user?.type === "member" ||
    session?.user?.type === "projectManager" ||
    session?.user?.type === "orgAdmin";
  const canMark =
    session?.user?.type === "superAdmin" ||
    session?.user?.type === "orgAdmin" ||
    session?.user?.type === "projectManager";

  const attendanceKey = isMember
    ? `/api/attendance${date ? `?date=${date}` : ""}`
    : orgId
      ? `/api/attendance?orgId=${orgId}${date ? `&date=${date}` : ""}`
      : null;

  const usersKey = !isMember && orgId ? `/api/users?orgId=${orgId}` : null;

  const {
    data: attendance = [],
    error: swrError,
    mutate,
  } = useSWR<Row[]>(attendanceKey);
  const { data: users = [] } = useSWR<User[]>(usersKey);

  const rows = useMemo(() => {
    const map = Object.fromEntries(users.map((x) => [x.id, x]));
    return attendance.map((r) => ({ ...r, user: map[r.userId] }));
  }, [attendance, users]);

  async function mark(id: string, status: string) {
    setPending(true);
    try {
      await api(`/api/attendance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await mutate();
    } finally {
      setPending(false);
    }
  }

  function statusVariant(s: string) {
    if (s === "present") return "success" as const;
    if (s === "leave" || s === "half_day") return "warning" as const;
    return "danger" as const;
  }

  const error = swrError instanceof Error ? swrError.message : "";

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Clock in/out follows your shift (including overnight). EOD is required on clock out."
      />

      {canClock ? (
        <div className="mb-6">
          <ClockWidget />
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Attendance records
          </CardTitle>
          <Input
            type="date"
            className="w-full sm:w-48"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
          {!isMember && !orgId ? (
            <EmptyState message="Select an organization from the top bar." />
          ) : rows.length === 0 ? (
            <EmptyState message="No attendance records yet." />
          ) : (
            <Table>
              <THead>
                <TR>
                  {!isMember ? <TH>Employee</TH> : null}
                  <TH>Date</TH>
                  <TH>Clock in</TH>
                  <TH>Clock out</TH>
                  <TH>Hours</TH>
                  <TH>Status</TH>
                  <TH>EOD</TH>
                  {canMark ? <TH>Mark</TH> : null}
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    {!isMember ? (
                      <TD>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={r.user?.name || "?"} />
                          <div>
                            <p className="text-sm text-white">
                              {r.user?.name || r.userId.slice(-6)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {r.user?.designation || r.user?.type}
                            </p>
                          </div>
                        </div>
                      </TD>
                    ) : null}
                    <TD className="whitespace-nowrap text-white">
                      {formatDateKey(r.date)}
                    </TD>
                    <TD className="whitespace-nowrap text-gray-400">
                      {r.clockIn ? formatTime(r.clockIn) : "—"}
                    </TD>
                    <TD className="whitespace-nowrap text-gray-400">
                      {r.clockOut ? formatTime(r.clockOut) : "—"}
                    </TD>
                    <TD className="text-teal-400">
                      {r.workedMinutes
                        ? `${(r.workedMinutes / 60).toFixed(2)}h`
                        : "—"}
                    </TD>
                    <TD>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TD>
                    <TD>
                      {r.eod?.summary ? (
                        <button
                          type="button"
                          className="text-sm text-teal-400 hover:underline"
                          onClick={() => setViewEod(r)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </TD>
                    {canMark ? (
                      <TD>
                        <Select
                          className="h-8 w-28 text-xs"
                          value={r.status}
                          disabled={pending}
                          onChange={(e) => mark(r.id, e.target.value)}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="half_day">Half day</option>
                          <option value="leave">Leave</option>
                          <option value="holiday">Holiday</option>
                        </Select>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {viewEod ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardContent className="space-y-4 pt-5">
              <div>
                <h3 className="text-base font-semibold text-white">
                  End of Day report
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {viewEod.user?.name || "Employee"} ·{" "}
                  {formatDateKey(viewEod.date)}
                  {viewEod.eod?.submittedAt
                    ? ` · ${formatDateTime(viewEod.eod.submittedAt)}`
                    : ""}
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Summary
                  </p>
                  <p className="mt-1 text-white">
                    {viewEod.eod?.summary || "—"}
                  </p>
                </div>
                {viewEod.eod?.blockers ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Blockers
                    </p>
                    <p className="mt-1 text-white">{viewEod.eod.blockers}</p>
                  </div>
                ) : null}
                {viewEod.eod?.nextPlan ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Next-day plan
                    </p>
                    <p className="mt-1 text-white">{viewEod.eod.nextPlan}</p>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setViewEod(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
