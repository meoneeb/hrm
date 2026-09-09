"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId, useShell } from "@/components/layout/shell-context";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { InitialsAvatar, RowActions } from "@/components/ui/row-actions";

type Payroll = { id: string; month: number; year: number; status: string };
type Payslip = {
  id: string;
  userId: string;
  presentDays: number;
  workingDays: number;
  basic: number;
  net: number;
  deductions: number;
  breakdown?: {
    leaveDeficitDays?: number;
    leaveDeduction?: number;
  };
  user?: User;
};
type User = { id: string; name: string; designation?: string };

export default function PayrollPage() {
  const { data: session } = useSession();
  const orgId = useOrgId();
  const { currentOrg } = useShell();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const canGenerate =
    session?.user?.type === "superAdmin" || session?.user?.type === "orgAdmin";

  const payrollsKey =
    canGenerate && orgId ? `/api/payrolls?orgId=${orgId}` : null;
  const payslipsKey = canGenerate
    ? orgId
      ? `/api/payslips?orgId=${orgId}`
      : null
    : session?.user
      ? "/api/payslips"
      : null;
  const usersKey = canGenerate && orgId ? `/api/users?orgId=${orgId}` : null;

  const {
    data: payrolls = [],
    mutate: mutatePayrolls,
  } = useSWR<Payroll[]>(payrollsKey);
  const {
    data: rawPayslips = [],
    error: swrError,
    mutate: mutatePayslips,
  } = useSWR<Payslip[]>(payslipsKey);
  const { data: users = [] } = useSWR<User[]>(usersKey);

  const payslips = useMemo(() => {
    const map = Object.fromEntries(users.map((x) => [x.id, x]));
    return rawPayslips.map((row) => ({ ...row, user: map[row.userId] }));
  }, [rawPayslips, users]);

  async function generate(m = month, y = year) {
    if (!orgId) return setError("Select an org");
    setError("");
    setMsg("");
    setSaving(true);
    try {
      await api("/api/payrolls", {
        method: "POST",
        body: JSON.stringify({ orgId, month: m, year: y }),
      });
      setMsg("Payroll generated");
      await Promise.all([mutatePayrolls(), mutatePayslips()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const processed = payslips.filter((p) => p.net > 0).length;
  const pendingCount = Math.max(0, payslips.length - processed);
  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Monthly payslips are org-scoped and ignore project assignment."
      />
      {canGenerate ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generate payroll</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <Button
              onClick={() => generate()}
              disabled={!orgId}
              loading={saving}
            >
              Generate / Process
            </Button>
            {msg ? <p className="text-sm text-teal-400">{msg}</p> : null}
            {displayError ? (
              <p className="text-sm text-red-400">{displayError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {payslips.length > 0 ? (
        <Card className="mb-6">
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-white">
                Payroll completion — {month}/{year}
              </p>
              <p>
                <span className="text-teal-400">{processed} processed</span>
                {" · "}
                <span className="text-amber-400">{pendingCount} pending</span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{
                  width: `${
                    payslips.length
                      ? Math.round((processed / payslips.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {processed} of {payslips.length} employees paid
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!canGenerate ? null : !orgId ? (
        <EmptyState message="Select an organization from the top bar." />
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payroll runs</CardTitle>
          </CardHeader>
          <CardContent>
            {payrolls.length === 0 ? (
              <EmptyState message="No payroll runs yet." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Month</TH>
                    <TH>Year</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {payrolls.map((p) => (
                    <TR key={p.id}>
                      <TD>{p.month}</TD>
                      <TD>{p.year}</TD>
                      <TD>
                        <Badge variant="success">{p.status}</Badge>
                      </TD>
                      <TD>
                        <RowActions
                          actions={[
                            {
                              label: "History",
                              variant: "view",
                              onClick: () => {
                                setMonth(p.month);
                                setYear(p.year);
                              },
                            },
                            {
                              label: "Process",
                              onClick: () => {
                                setMonth(p.month);
                                setYear(p.year);
                                void generate(p.month, p.year);
                              },
                              disabled: saving,
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <EmptyState message="No payslips yet." />
          ) : (
            <Table>
              <THead>
                <TR>
                  {canGenerate ? <TH>Employee</TH> : null}
                  <TH>Present</TH>
                  <TH>Working</TH>
                  <TH>Basic</TH>
                  <TH>Deductions</TH>
                  <TH>Net</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {payslips.map((s) => (
                  <TR key={s.id}>
                    {canGenerate ? (
                      <TD>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={s.user?.name || "?"} />
                          <div>
                            <p className="text-sm text-white">
                              {s.user?.name || s.userId.slice(-6)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {s.user?.designation}
                            </p>
                          </div>
                        </div>
                      </TD>
                    ) : null}
                    <TD>{s.presentDays}</TD>
                    <TD>{s.workingDays}</TD>
                    <TD>
                      <Money
                        amount={s.basic}
                        currency={currentOrg?.currency || "PKR"}
                        secondaryCurrency={currentOrg?.secondaryCurrency}
                        fxRate={currentOrg?.fxRate || 1}
                      />
                    </TD>
                    <TD>
                      <div>
                        <Money
                          amount={s.deductions}
                          currency={currentOrg?.currency || "PKR"}
                          secondaryCurrency={currentOrg?.secondaryCurrency}
                          fxRate={currentOrg?.fxRate || 1}
                        />
                        {s.breakdown?.leaveDeficitDays ? (
                          <p className="text-xs text-amber-400">
                            Leave deficit {s.breakdown.leaveDeficitDays}d
                          </p>
                        ) : null}
                      </div>
                    </TD>
                    <TD>
                      <Money
                        amount={s.net}
                        currency={currentOrg?.currency || "PKR"}
                        secondaryCurrency={currentOrg?.secondaryCurrency}
                        fxRate={currentOrg?.fxRate || 1}
                      />
                    </TD>
                    <TD>
                      <Badge variant={s.net > 0 ? "success" : "warning"}>
                        {s.net > 0 ? "Processed" : "Pending"}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
