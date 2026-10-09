"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui/misc";
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
import { RowActions } from "@/components/ui/row-actions";
import { HolidayCalendar } from "@/components/orgs/holiday-calendar";
import { formatDateKey, formatShiftTime } from "@/lib/datetime";

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

type Holiday = {
  id: string;
  date: string;
  name?: string;
};

const NONE = "__none__";

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-sm text-white">{value || "—"}</p>
    </div>
  );
}

export default function OrgDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orgId = params.id;

  const {
    data: org,
    error: swrError,
    mutate,
  } = useSWR<Org>(orgId ? `/api/orgs/${orgId}` : null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    timezone: "Asia/Karachi",
    currency: "PKR",
    secondaryCurrency: "",
    fxRate: "1",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: "General",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: "15",
  });
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const now = new Date();
  const [holidayMonth, setHolidayMonth] = useState(now.getMonth() + 1);
  const [holidayYear, setHolidayYear] = useState(now.getFullYear());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: shifts = [], mutate: mutateShifts } = useSWR<Shift[]>(
    orgId ? `/api/shifts?orgId=${orgId}` : null
  );
  const { data: holidays = [], mutate: mutateHolidays } = useSWR<Holiday[]>(
    orgId
      ? `/api/holidays?orgId=${orgId}&month=${holidayMonth}&year=${holidayYear}`
      : null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const edit = new URLSearchParams(window.location.search).get("edit");
    if (edit === "1") setIsEditing(true);
  }, []);

  useEffect(() => {
    if (!org) return;
    setEditForm({
      name: org.name,
      code: org.code,
      timezone: org.timezone,
      currency: org.currency || "PKR",
      secondaryCurrency: org.secondaryCurrency || "",
      fxRate: String(org.fxRate || 1),
    });
  }, [org]);

  function resetShiftForm() {
    setEditingShift(null);
    setShiftForm({
      name: "General",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: "15",
    });
  }

  function startEditShift(s: Shift) {
    setEditingShift(s);
    setShiftForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      graceMinutes: String(s.graceMinutes ?? 15),
    });
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setPending(true);
    setError("");
    try {
      await api<Org>(`/api/orgs/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          timezone: editForm.timezone,
          currency: editForm.currency,
          secondaryCurrency: editForm.secondaryCurrency || null,
          fxRate: Number(editForm.fxRate) || 1,
          defaultShiftId: org.defaultShiftId || null,
        }),
      });
      setIsEditing(false);
      await mutate();
      router.replace(`/dashboard/orgs/${org.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  function cancelEdit() {
    if (!org) return;
    setEditForm({
      name: org.name,
      code: org.code,
      timezone: org.timezone,
      currency: org.currency || "PKR",
      secondaryCurrency: org.secondaryCurrency || "",
      fxRate: String(org.fxRate || 1),
    });
    setIsEditing(false);
    setError("");
    router.replace(`/dashboard/orgs/${org.id}`);
  }

  async function setDefaultShift(shiftId: string) {
    if (!org) return;
    setPending(true);
    try {
      await api<Org>(`/api/orgs/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ defaultShiftId: shiftId || null }),
      });
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setPending(true);
    setError("");
    try {
      const payload = {
        name: shiftForm.name,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        graceMinutes: Number(shiftForm.graceMinutes) || 15,
      };
      if (editingShift) {
        await api(`/api/shifts/${editingShift.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/shifts", {
          method: "POST",
          body: JSON.stringify({ orgId: org.id, ...payload }),
        });
      }
      resetShiftForm();
      await mutateShifts();
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function deleteShift(s: Shift) {
    if (!org) return;
    if (
      !confirm(
        `Delete shift “${s.name}”? Members on this shift will fall back to the org default.`
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await api(`/api/shifts/${s.id}`, { method: "DELETE" });
      if (editingShift?.id === s.id) resetShiftForm();
      await mutateShifts();
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function deactivate() {
    if (!org) return;
    if (!confirm(`Deactivate ${org.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/orgs/${org.id}`, { method: "DELETE" });
      router.push("/dashboard/orgs");
    } finally {
      setPending(false);
    }
  }

  const defaultShiftName =
    shifts.find((s) => s.id === org?.defaultShiftId)?.name || "None";
  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  if (displayError && !org) return <EmptyState message={displayError} />;
  if (!org) return <p className="text-gray-400">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={org.name}
        description={`${org.code} · ${org.timezone}`}
        actions={
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/orgs")}
          >
            <ArrowLeft className="h-4 w-4" />
            All orgs
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Organization details</CardTitle>
            <p className="mt-1 text-sm text-gray-400">
              {isEditing
                ? "Edit fields below, then save."
                : "Read-only view. Use Edit to change."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-400"
                  disabled={org.status !== "active" || pending}
                  onClick={deactivate}
                >
                  Deactivate
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={onSaveEdit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input value={editForm.code} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Timezone</Label>
                  <Input
                    value={editForm.timezone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, timezone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Input
                    value={editForm.currency}
                    onChange={(e) =>
                      setEditForm({ ...editForm, currency: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Secondary currency</Label>
                  <Input
                    value={editForm.secondaryCurrency}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        secondaryCurrency: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>FX rate</Label>
                  <Input
                    type="number"
                    value={editForm.fxRate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, fxRate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Input value={org.status} disabled />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Default shift</Label>
                  <Select
                    value={org.defaultShiftId || NONE}
                    onValueChange={(v) =>
                      setDefaultShift(v === NONE ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={pending}>
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={org.name} />
              <Field label="Code" value={org.code} />
              <Field label="Timezone" value={org.timezone} />
              <Field label="Currency" value={org.currency || "PKR"} />
              <Field
                label="Secondary currency"
                value={org.secondaryCurrency || "—"}
              />
              <Field label="FX rate" value={String(org.fxRate ?? 1)} />
              <Field
                label="Status"
                value={
                  <Badge
                    variant={org.status === "active" ? "success" : "muted"}
                  >
                    {org.status}
                  </Badge>
                }
              />
              <Field label="Default shift" value={defaultShiftName} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Shifts</CardTitle>
          <p className="text-sm text-gray-400">
            Overnight shifts use end time earlier than start (e.g. 21:00–01:00).
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveShift} className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {editingShift ? "Edit shift" : "Add shift"}
            </p>
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
                  min={0}
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
            <div className="flex gap-2">
              {editingShift ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  disabled={pending}
                  onClick={resetShiftForm}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" className="flex-1" loading={pending}>
                {editingShift ? "Save shift" : "Add shift"}
              </Button>
            </div>
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
                    <TH>Grace</TH>
                    <TH>Default</TH>
                    <TH className="text-right">Actions</TH>
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
                      <TD className="text-gray-400">{s.graceMinutes}m</TD>
                      <TD>
                        {org.defaultShiftId === s.id ? (
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
                      <TD>
                        <RowActions
                          actions={[
                            {
                              label: "Edit",
                              variant: "edit",
                              disabled: pending,
                              onClick: () => startEditShift(s),
                            },
                            {
                              label: "Delete",
                              variant: "delete",
                              disabled: pending,
                              onClick: () => deleteShift(s),
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Holidays</CardTitle>
            <p className="mt-1 text-sm text-gray-400">
              Weekday holidays reduce working days for payroll. Attendance status
              for a member on that day still overrides for that person.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarDays className="h-4 w-4" />
            View calendar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input
                type="number"
                min={1}
                max={12}
                className="w-20"
                value={holidayMonth}
                onChange={(e) => setHolidayMonth(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input
                type="number"
                className="w-24"
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value))}
              />
            </div>
          </div>
          {holidays.length === 0 ? (
            <EmptyState message="No holidays in this month. Open the calendar to add one." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Label</TH>
                </TR>
              </THead>
              <TBody>
                {holidays.map((h) => (
                  <TR key={h.id}>
                    <TD>{formatDateKey(h.date)}</TD>
                    <TD className="text-gray-400">{h.name || "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <HolidayCalendar
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        orgId={org.id}
        orgName={org.name}
        month={holidayMonth}
        year={holidayYear}
        onMonthChange={(m, y) => {
          setHolidayMonth(m);
          setHolidayYear(y);
        }}
        holidays={holidays}
        onChanged={mutateHolidays}
      />
    </div>
  );
}
