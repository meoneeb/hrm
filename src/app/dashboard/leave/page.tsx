"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId } from "@/components/layout/shell-context";
import { PageHeader, EmptyState, Textarea } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type LeaveType = { id: string; name: string; paid: boolean };
type Leave = {
  id: string;
  from: string;
  to: string;
  days: number;
  status: string;
  reason?: string;
  userId: string;
};

export default function LeavePage() {
  const { data: session } = useSession();
  const orgId = useOrgId();
  const [form, setForm] = useState({
    typeId: "",
    from: "",
    to: "",
    reason: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const canApprove =
    session?.user?.type === "superAdmin" ||
    session?.user?.type === "orgAdmin" ||
    session?.user?.type === "projectManager";

  const oid = orgId || session?.user?.orgId || "";
  const canFetch = Boolean(oid) || session?.user?.type === "member";
  const typesKey = oid ? `/api/leave-types?orgId=${oid}` : null;
  const leavesKey = canFetch ? `/api/leaves${oid ? `?orgId=${oid}` : ""}` : null;

  const { data: types = [], mutate: mutateTypes } = useSWR<LeaveType[]>(typesKey);
  const {
    data: leaves = [],
    error: swrError,
    mutate: mutateLeaves,
  } = useSWR<Leave[]>(leavesKey);

  useEffect(() => {
    if (!form.typeId && types[0]) {
      setForm((f) => ({ ...f, typeId: types[0].id }));
    }
  }, [types, form.typeId]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/leaves", {
        method: "POST",
        body: JSON.stringify({ ...form, orgId: orgId || session?.user?.orgId }),
      });
      setForm({ ...form, from: "", to: "", reason: "" });
      await mutateLeaves();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    setDecidingId(id);
    try {
      await api(`/api/leaves/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await mutateLeaves();
    } finally {
      setDecidingId(null);
    }
  }

  async function addLeaveType() {
    if (!oid) return setError("Select an org");
    const name = prompt("Leave type name?");
    if (!name) return;
    setAddingType(true);
    try {
      await api("/api/leave-types", {
        method: "POST",
        body: JSON.stringify({
          orgId: oid,
          name,
          defaultCredits: 12,
          paid: true,
        }),
      });
      await mutateTypes();
    } finally {
      setAddingType(false);
    }
  }

  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Apply and approve leave. Credits live on the user; records are org-scoped."
        actions={
          canApprove && session?.user?.type !== "projectManager" ? (
            <Button
              variant="outline"
              onClick={addLeaveType}
              loading={addingType}
            >
              Add leave type
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Apply leave</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={apply} className="space-y-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.typeId || undefined}
                  onValueChange={(v) => setForm({ ...form, typeId: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.paid ? "(paid)" : "(unpaid)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  type="date"
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              {displayError ? (
                <p className="text-sm text-red-400">{displayError}</p>
              ) : null}
              <Button type="submit" className="w-full" loading={saving}>
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {leaves.length === 0 ? (
              <EmptyState message="No leave requests." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>From</TH>
                    <TH>To</TH>
                    <TH>Days</TH>
                    <TH>Status</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {leaves.map((l) => (
                    <TR key={l.id}>
                      <TD>{l.from}</TD>
                      <TD>{l.to}</TD>
                      <TD>{l.days}</TD>
                      <TD>
                        <Badge
                          variant={
                            l.status === "approved"
                              ? "success"
                              : l.status === "pending"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {l.status}
                        </Badge>
                      </TD>
                      <TD className="space-x-2">
                        {canApprove && l.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              loading={decidingId === l.id}
                              disabled={decidingId !== null && decidingId !== l.id}
                              onClick={() => decide(l.id, "approved")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={decidingId === l.id}
                              disabled={decidingId !== null && decidingId !== l.id}
                              onClick={() => decide(l.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
