"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useOrgId } from "@/components/layout/shell-context";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateKey } from "@/lib/datetime";

type MemberRow = {
  userId: string;
  name: string;
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  holiday: number;
  total: number;
};

type Report = {
  month: number;
  year: number;
  workingDays: number;
  holidays: string[];
  members: MemberRow[];
};

type User = { id: string; name: string; type: string; active?: boolean };

export default function ReportsPage() {
  const orgId = useOrgId();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [reportKey, setReportKey] = useState<string | null>(null);

  const usersKey = orgId ? `/api/users?orgId=${orgId}` : null;
  const { data: users = [] } = useSWR<User[]>(usersKey);

  const memberOptions = useMemo(
    () =>
      users
        .filter(
          (u) =>
            (u.type === "member" || u.type === "projectManager") &&
            u.active !== false
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: u.name })),
    [users]
  );

  useEffect(() => {
    setReportKey(null);
    setMemberIds([]);
  }, [orgId]);

  const {
    data: report,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Report>(reportKey);

  function runReport() {
    if (!orgId) return;
    const ids =
      memberIds.length > 0 ? `&userIds=${memberIds.join(",")}` : "";
    const key = `/api/reports/attendance?orgId=${orgId}&month=${month}&year=${year}${ids}`;
    if (reportKey === key) {
      void mutate();
    } else {
      setReportKey(key);
    }
  }

  const error = swrError instanceof Error ? swrError.message : "";
  const running = Boolean(reportKey) && (isLoading || isValidating);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Monthly attendance by employee. Working days exclude weekends and org holidays."
      />
      {!orgId ? (
        <EmptyState message="Select an organization from the top bar." />
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="w-24"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    className="w-28"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                </div>
                <div className="min-w-[16rem] flex-1 space-y-1">
                  <Label>Members</Label>
                  <MultiSelect
                    options={memberOptions}
                    value={memberIds}
                    onChange={setMemberIds}
                    placeholder="All members"
                    label="Filter members"
                  />
                </div>
                <Button onClick={runReport} loading={running}>
                  Run report
                </Button>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </CardContent>
          </Card>

          {report ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <span>
                  Working days:{" "}
                  <span className="font-semibold text-white">
                    {report.workingDays}
                  </span>
                </span>
                <span>
                  Org holidays:{" "}
                  <span className="font-semibold text-white">
                    {report.holidays.length}
                  </span>
                  {report.holidays.length
                    ? ` (${report.holidays.map(formatDateKey).join(", ")})`
                    : ""}
                </span>
              </div>
              {report.members.length === 0 ? (
                <EmptyState message="No employees match this filter." />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance by employee</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <THead>
                        <TR>
                          <TH>Employee</TH>
                          <TH>Present</TH>
                          <TH>Absent</TH>
                          <TH>Half day</TH>
                          <TH>Leave</TH>
                          <TH>Holiday</TH>
                          <TH>Total</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {report.members.map((m) => (
                          <TR key={m.userId}>
                            <TD className="text-white">{m.name}</TD>
                            <TD>{m.present}</TD>
                            <TD>{m.absent}</TD>
                            <TD>{m.half_day}</TD>
                            <TD>{m.leave}</TD>
                            <TD>{m.holiday}</TD>
                            <TD className="text-teal-400">{m.total}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <EmptyState
              message={
                running ? "Loading report…" : "No report loaded yet."
              }
            />
          )}
        </>
      )}
    </div>
  );
}
