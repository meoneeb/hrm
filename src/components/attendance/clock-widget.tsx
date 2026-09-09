"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Clock3 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useOrgId } from "@/components/layout/shell-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/misc";
import {
  formatDateKey,
  formatShiftTime,
  formatTime,
} from "@/lib/datetime";

type Attendance = {
  id: string;
  status: string;
  date?: string;
  clockIn?: string | null;
  clockOut?: string | null;
  lateMinutes?: number;
  workedMinutes?: number;
  eod?: {
    summary?: string;
    blockers?: string;
    nextPlan?: string;
    submittedAt?: string;
  } | null;
};

type ShiftInfo = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  label: string;
};

type CurrentPayload = {
  orgId: string;
  shift: ShiftInfo | null;
  shiftDate: string | null;
  attendance: Attendance | null;
  canClockIn: boolean;
  canClockOut: boolean;
};

export function ClockWidget() {
  const orgId = useOrgId();
  const key = orgId
    ? `/api/attendance/current?orgId=${orgId}`
    : "/api/attendance/current";
  const { data, mutate, error: swrError } = useSWR<CurrentPayload>(key);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [showEod, setShowEod] = useState(false);
  const [eod, setEod] = useState({
    summary: "",
    blockers: "",
    nextPlan: "",
  });

  const today = data?.attendance || null;
  const shift = data?.shift || null;
  const canClockIn = !!data?.canClockIn;
  const canClockOut = !!data?.canClockOut;

  const phase = useMemo(() => {
    if (today?.clockIn && today?.clockOut) return "complete" as const;
    if (today?.clockIn && !today?.clockOut) return "active" as const;
    return "idle" as const;
  }, [today]);

  const hoursLabel =
    today?.workedMinutes != null && today.workedMinutes > 0
      ? `${(today.workedMinutes / 60).toFixed(2)}h`
      : today?.clockIn && !today?.clockOut
        ? "In progress"
        : "—";

  async function clockIn() {
    setPending(true);
    setMessage("");
    try {
      await api("/api/attendance/clock", {
        method: "POST",
        body: JSON.stringify({ action: "in", orgId: orgId || undefined }),
      });
      setMessage("Clocked in");
      await mutate();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function submitEod(e: React.FormEvent) {
    e.preventDefault();
    if (!eod.summary.trim()) {
      setMessage("EOD summary is required");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      await api("/api/attendance/clock", {
        method: "POST",
        body: JSON.stringify({
          action: "out",
          orgId: orgId || undefined,
          eod: {
            summary: eod.summary.trim(),
            blockers: eod.blockers.trim() || undefined,
            nextPlan: eod.nextPlan.trim() || undefined,
          },
        }),
      });
      setMessage("Clocked out");
      setShowEod(false);
      setEod({ summary: "", blockers: "", nextPlan: "" });
      await mutate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {phase === "complete"
                  ? "Day complete"
                  : phase === "active"
                    ? "On shift"
                    : "Ready to clock in"}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {shift
                  ? `${shift.name} · ${formatShiftTime(shift.startTime)} – ${formatShiftTime(shift.endTime)}${shift.overnight ? " (+1 day)" : ""}`
                  : "No shift assigned"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="min-w-28"
                loading={pending}
                disabled={!canClockIn}
                onClick={clockIn}
              >
                Clock In
              </Button>
              <Button
                variant="secondary"
                className="min-w-28"
                loading={pending}
                disabled={!canClockOut}
                onClick={() => setShowEod(true)}
              >
                Clock Out
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Workday"
              value={formatDateKey(data?.shiftDate || today?.date)}
            />
            <Stat
              label="Clock in"
              value={today?.clockIn ? formatTime(today.clockIn) : "—"}
              accent={!!today?.clockIn}
            />
            <Stat
              label="Clock out"
              value={today?.clockOut ? formatTime(today.clockOut) : "—"}
            />
            <Stat
              label="Total hours"
              value={hoursLabel}
              accent={
                hoursLabel !== "—" && hoursLabel !== "In progress"
              }
            />
          </div>

          <div className="flex items-center gap-2 border-t border-white/5 pt-4 text-sm">
            {phase === "complete" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                <span className="text-teal-400">Day complete</span>
              </>
            ) : phase === "active" ? (
              <>
                <Clock3 className="h-4 w-4 text-amber-400" />
                <span className="text-amber-400">Shift in progress</span>
              </>
            ) : (
              <>
                <Clock3 className="h-4 w-4 text-gray-500" />
                <span className="text-gray-500">Not clocked in yet</span>
              </>
            )}
            {today?.lateMinutes ? (
              <span className="text-xs text-amber-400">
                · Late {today.lateMinutes}m
              </span>
            ) : null}
          </div>

          {message ? <p className="text-sm text-teal-400">{message}</p> : null}
          {swrError ? (
            <p className="text-sm text-red-400">
              {swrError instanceof Error ? swrError.message : "Failed to load"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showEod ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardContent className="space-y-4 pt-5">
              <div>
                <h3 className="text-base font-semibold text-white">
                  End of Day report
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Required before clocking out.
                </p>
              </div>
              <form onSubmit={submitEod} className="space-y-3">
                <div className="space-y-1">
                  <Label>Summary *</Label>
                  <Textarea
                    value={eod.summary}
                    onChange={(e) =>
                      setEod({ ...eod, summary: e.target.value })
                    }
                    required
                    placeholder="What did you accomplish?"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Blockers</Label>
                  <Textarea
                    value={eod.blockers}
                    onChange={(e) =>
                      setEod({ ...eod, blockers: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Next-day plan</Label>
                  <Textarea
                    value={eod.nextPlan}
                    onChange={(e) =>
                      setEod({ ...eod, nextPlan: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                {message ? (
                  <p className="text-sm text-red-400">{message}</p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setShowEod(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    Submit & clock out
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          accent ? "text-teal-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
