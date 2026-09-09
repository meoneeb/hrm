"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId } from "@/components/layout/shell-context";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const ALL = "__all__";

export default function AttendancePage() {
  const { data: session } = useSession();
  const orgId = useOrgId();
  const [date, setDate] = useState("");
  const [memberId, setMemberId] = useState("");
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
      ? `/api/attendance?orgId=${orgId}${date ? `&date=${date}` : ""}${
          memberId ? `&userId=${memberId}` : ""
        }`
      : null;

  const usersKey = !isMember && orgId ? `/api/users?orgId=${orgId}` : null;

  const {
    data: attendance = [],
    error: swrError,
    mutate,
  } = useSWR<Row[]>(attendanceKey);
  const { data: users = [] } = useSWR<User[]>(usersKey);

  const memberOptions = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  useEffect(() => {
    setMemberId("");
  }, [orgId]);

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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {!isMember ? (
              <Select
                value={memberId || ALL}
                onValueChange={(v) => setMemberId(v === ALL ? "" : v)}
                disabled={!orgId}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All members</SelectItem>
                  {memberOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              type="date"
              className="w-full sm:w-48"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 text-teal-400 hover:bg-transparent hover:text-teal-300 hover:underline"
                          onClick={() => setViewEod(r)}
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </TD>
                    {canMark ? (
                      <TD>
                        <Select
                          value={r.status}
                          disabled={pending}
                          onValueChange={(v) => mark(r.id, v)}
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="half_day">Half day</SelectItem>
                            <SelectItem value="leave">Leave</SelectItem>
                            <SelectItem value="holiday">Holiday</SelectItem>
                          </SelectContent>
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

      <Dialog
        open={!!viewEod}
        onOpenChange={(open) => {
          if (!open) setViewEod(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End of Day report</DialogTitle>
            <DialogDescription>
              {viewEod?.user?.name || "Employee"} ·{" "}
              {viewEod ? formatDateKey(viewEod.date) : ""}
              {viewEod?.eod?.submittedAt
                ? ` · ${formatDateTime(viewEod.eod.submittedAt)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Summary
              </p>
              <p className="mt-1 text-white">{viewEod?.eod?.summary || "—"}</p>
            </div>
            {viewEod?.eod?.blockers ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Blockers
                </p>
                <p className="mt-1 text-white">{viewEod.eod.blockers}</p>
              </div>
            ) : null}
            {viewEod?.eod?.nextPlan ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Next-day plan
                </p>
                <p className="mt-1 text-white">{viewEod.eod.nextPlan}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewEod(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
