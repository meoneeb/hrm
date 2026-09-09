"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { PageHeader, EmptyState, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";
import { formatShiftTime } from "@/lib/datetime";

type Org = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  status: string;
  currency?: string;
  secondaryCurrency?: string | null;
  fxRate?: number;
  defaultShiftId?: string | null;
};

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
};

const empty = {
  name: "",
  code: "",
  timezone: "UTC",
  currency: "PKR",
  secondaryCurrency: "",
  fxRate: "1",
};

export default function OrgsPage() {
  const { data: orgs = [], error: swrError, mutate } = useSWR<Org[]>("/api/orgs");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Org | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: "General",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: "15",
  });

  const shiftsKey = editing ? `/api/shifts?orgId=${editing.id}` : null;
  const { data: shifts = [], mutate: mutateShifts } = useSWR<Shift[]>(shiftsKey);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/api/orgs", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          secondaryCurrency: form.secondaryCurrency || null,
          fxRate: Number(form.fxRate) || 1,
        }),
      });
      setForm(empty);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    try {
      await api(`/api/orgs/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          timezone: form.timezone,
          currency: form.currency,
          secondaryCurrency: form.secondaryCurrency || null,
          fxRate: Number(form.fxRate) || 1,
          defaultShiftId: editing.defaultShiftId || null,
        }),
      });
      setEditing(null);
      setForm(empty);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  function startEdit(o: Org) {
    setEditing(o);
    setForm({
      name: o.name,
      code: o.code,
      timezone: o.timezone,
      currency: o.currency || "PKR",
      secondaryCurrency: o.secondaryCurrency || "",
      fxRate: String(o.fxRate || 1),
    });
  }

  async function setDefaultShift(shiftId: string) {
    if (!editing) return;
    setPending(true);
    try {
      const res = await api<Org>(`/api/orgs/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ defaultShiftId: shiftId || null }),
      });
      setEditing({ ...editing, defaultShiftId: res.data.defaultShiftId });
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    setError("");
    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          orgId: editing.id,
          name: shiftForm.name,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          graceMinutes: Number(shiftForm.graceMinutes) || 15,
        }),
      });
      await mutateShifts();
      if (!editing.defaultShiftId) await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function deactivate(o: Org) {
    if (!confirm(`Deactivate ${o.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/orgs/${o.id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setPending(false);
    }
  }

  const displayError = error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Manage organizations, default shifts, and overnight schedules."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? "Edit organization" : "New organization"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={editing ? onSaveEdit : onCreate}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              {!editing ? (
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) =>
                    setForm({ ...form, timezone: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Secondary</Label>
                  <Input
                    value={form.secondaryCurrency}
                    onChange={(e) =>
                      setForm({ ...form, secondaryCurrency: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>FX rate</Label>
                <Input
                  type="number"
                  value={form.fxRate}
                  onChange={(e) => setForm({ ...form, fxRate: e.target.value })}
                />
              </div>
              {editing ? (
                <div className="space-y-1">
                  <Label>Default shift</Label>
                  <Select
                    value={editing.defaultShiftId || ""}
                    onChange={(e) => setDefaultShift(e.target.value)}
                  >
                    <option value="">None</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {displayError ? (
                <p className="text-sm text-red-400">{displayError}</p>
              ) : null}
              <div className="flex gap-2">
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    disabled={pending}
                    onClick={() => {
                      setEditing(null);
                      setForm(empty);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" className="flex-1" loading={pending}>
                  {editing ? "Save" : "Create org"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All orgs</CardTitle>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <EmptyState message="No organizations yet." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Code</TH>
                    <TH>Currency</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {orgs.map((o) => (
                    <TR key={o.id}>
                      <TD>{o.name}</TD>
                      <TD className="text-gray-400">{o.code}</TD>
                      <TD className="text-gray-400">
                        {o.currency || "PKR"}
                        {o.secondaryCurrency
                          ? ` / ${o.secondaryCurrency}`
                          : ""}
                      </TD>
                      <TD>
                        <Badge
                          variant={o.status === "active" ? "success" : "muted"}
                        >
                          {o.status}
                        </Badge>
                      </TD>
                      <TD>
                        <RowActions
                          actions={[
                            {
                              label: "Edit",
                              variant: "edit",
                              onClick: () => startEdit(o),
                            },
                            {
                              label: "Deactivate",
                              variant: "delete",
                              onClick: () => deactivate(o),
                              disabled: o.status !== "active" || pending,
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
      </div>

      {editing ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Shifts for {editing.name}</CardTitle>
            <p className="text-sm text-gray-400">
              Overnight shifts use end time earlier than start (e.g. 21:00–01:00).
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={createShift} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={shiftForm.name}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, startTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, endTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Grace</Label>
                  <Input
                    type="number"
                    value={shiftForm.graceMinutes}
                    onChange={(e) =>
                      setShiftForm({
                        ...shiftForm,
                        graceMinutes: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <Button type="submit" loading={pending}>
                Add shift
              </Button>
            </form>
            <div>
              {shifts.length === 0 ? (
                <EmptyState message="No shifts yet — General is created on org create." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Hours</TH>
                      <TH>Default</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {shifts.map((s) => (
                      <TR key={s.id}>
                        <TD>{s.name}</TD>
                        <TD className="text-gray-400">
                          {formatShiftTime(s.startTime)} –{" "}
                          {formatShiftTime(s.endTime)}
                        </TD>
                        <TD>
                          {editing.defaultShiftId === s.id ? (
                            <Badge variant="success">default</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => setDefaultShift(s.id)}
                            >
                              Make default
                            </Button>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
