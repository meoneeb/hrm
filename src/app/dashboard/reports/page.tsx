"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useOrgId } from "@/components/layout/shell-context";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  holiday: number;
  total: number;
  month: number;
  year: number;
};

export default function ReportsPage() {
  const orgId = useOrgId();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reportKey, setReportKey] = useState<string | null>(null);

  useEffect(() => {
    setReportKey(null);
  }, [orgId]);

  const {
    data: summary,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Summary>(reportKey);

  function runReport() {
    if (!orgId) return;
    const key = `/api/reports/attendance?orgId=${orgId}&month=${month}&year=${year}`;
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
        description="Monthly attendance summary for the selected organization."
      />
      {!orgId ? (
        <EmptyState message="Select an organization from the top bar." />
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
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
              <Button onClick={runReport} loading={running}>
                Run report
              </Button>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </CardContent>
          </Card>
          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["Present", summary.present],
                  ["Absent", summary.absent],
                  ["Half day", summary.half_day],
                  ["Leave", summary.leave],
                  ["Holiday", summary.holiday],
                  ["Total punches", summary.total],
                ] as const
              ).map(([label, value]) => (
                <Card key={label}>
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-400">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-white">{value}</p>
                  </CardContent>
                </Card>
              ))}
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
