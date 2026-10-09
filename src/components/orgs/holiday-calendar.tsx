"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDateKey } from "@/lib/datetime";

export type Holiday = {
  id: string;
  date: string;
  name?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  month: number;
  year: number;
  onMonthChange: (month: number, year: number) => void;
  holidays: Holiday[];
  onChanged: () => Promise<unknown>;
};

export function HolidayCalendar({
  open,
  onOpenChange,
  orgId,
  orgName,
  month,
  year,
  onMonthChange,
  holidays,
  onChanged,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addName, setAddName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const byDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const list = map.get(h.date) || [];
      list.push(h);
      map.set(h.date, list);
    }
    return map;
  }, [holidays]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const items: Array<{ key: string; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) {
      items.push({ key: `pad-${i}`, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      items.push({ key: dateKey(year, month, d), day: d });
    }
    return items;
  }, [year, month]);

  function prevMonth() {
    if (month === 1) onMonthChange(12, year - 1);
    else onMonthChange(month - 1, year);
    setSelected(null);
  }

  function nextMonth() {
    if (month === 12) onMonthChange(1, year + 1);
    else onMonthChange(month + 1, year);
    setSelected(null);
  }

  function openAdd(date: string) {
    setAddDate(date);
    setAddName("");
    setError("");
    setAddOpen(true);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addDate) return;
    setPending(true);
    setError("");
    try {
      await api("/api/holidays", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          date: addDate,
          name: addName.trim() || undefined,
        }),
      });
      setAddOpen(false);
      setSelected(addDate);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function removeHoliday(h: Holiday) {
    if (!confirm(`Remove holiday ${formatDateKey(h.date)}?`)) return;
    setPending(true);
    setError("");
    try {
      await api(`/api/holidays/${h.id}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  const selectedHolidays = selected ? byDate.get(selected) || [] : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Holiday calendar</DialogTitle>
            <DialogDescription>
              {orgName} — hover a day to add a holiday; click a day to preview.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold text-white">
              {MONTHS[month - 1]} {year}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (cell.day == null) {
                return <div key={cell.key} className="min-h-16" />;
              }
              const key = cell.key;
              const dayHolidays = byDate.get(key) || [];
              const hasHoliday = dayHolidays.length > 0;
              const isSelected = selected === key;
              const isHovered = hovered === key;
              const label = dayHolidays
                .map((h) => h.name || "Holiday")
                .join(", ");

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  title={hasHoliday ? label : undefined}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(key);
                    }
                  }}
                  className={cn(
                    "relative flex min-h-16 cursor-pointer flex-col items-start rounded-md border p-1.5 text-left transition-colors",
                    hasHoliday
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/10 bg-background hover:border-white/20",
                    isSelected && "ring-2 ring-teal-500/50"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      hasHoliday ? "text-teal-300" : "text-white"
                    )}
                  >
                    {cell.day}
                  </span>
                  {hasHoliday ? (
                    <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-teal-400/90">
                      {label}
                    </span>
                  ) : null}
                  {isHovered ? (
                    <button
                      type="button"
                      className={cn(
                        "absolute flex items-center justify-center gap-0.5 font-bold tracking-tight",
                        hasHoliday
                          ? "right-1 top-1 rounded bg-zinc-800/90 px-1 py-0.5 text-[10px] text-teal-300"
                          : "inset-x-1 bottom-1 rounded bg-teal-500/90 px-1 py-0.5 text-[10px] text-teal-950"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAdd(key);
                      }}
                    >
                      {hasHoliday ? (
                        "+"
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Add
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-white/10 bg-muted/40 p-3">
            {selected ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {formatDateKey(selected)}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openAdd(selected)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add holiday
                  </Button>
                </div>
                {selectedHolidays.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No holidays on this day.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedHolidays.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-teal-300">
                          {h.name || "Holiday"}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          disabled={pending}
                          onClick={() => removeHoliday(h)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Click a date to preview holidays for that day. Dates with
                holidays show a teal highlight and label preview.
              </p>
            )}
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add holiday</DialogTitle>
            <DialogDescription>
              {addDate ? formatDateKey(addDate) : "Select a date"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Label (optional)</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Independence Day"
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Add holiday
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
