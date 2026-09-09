/** Time helpers for overnight-aware shift dates in an IANA timezone. */

export function parseTimeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isOvernight(startTime: string, endTime: string) {
  return parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime);
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock parts of an instant in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function toZonedDateKey(d: Date, timeZone: string) {
  const p = zonedParts(d, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** @deprecated Prefer toZonedDateKey — uses runtime local TZ. */
export function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToKey(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Convert a wall-clock date+time in `timeZone` to a UTC Date.
 * Iterates to resolve DST / offset correctly.
 */
export function zonedWallToUtc(
  dateKey: string,
  hhmm: string,
  timeZone: string
): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const desiredAsUtcMs = Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0, 0);
  let utcMs = desiredAsUtcMs;
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utcMs), timeZone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    utcMs += desiredAsUtcMs - asIfUtc;
  }
  return new Date(utcMs);
}

/**
 * Shift start calendar day for `now` in `timeZone`.
 * Overnight e.g. 20:00–04:00: between 00:00 and endTime → yesterday.
 */
export function getShiftDate(
  now: Date,
  startTime: string,
  endTime: string,
  timeZone = "Asia/Karachi"
): string {
  const today = toZonedDateKey(now, timeZone);
  if (!isOvernight(startTime, endTime)) return today;

  const parts = zonedParts(now, timeZone);
  const nowMin = parts.hour * 60 + parts.minute;
  const endMin = parseTimeToMinutes(endTime);
  if (nowMin < endMin) return addDaysToKey(today, -1);
  return today;
}

/** Minutes from shift start on shiftDate to `now` (can span midnight). */
export function minutesSinceShiftStart(
  now: Date,
  shiftDate: string,
  startTime: string,
  timeZone = "Asia/Karachi"
) {
  const start = zonedWallToUtc(shiftDate, startTime, timeZone);
  return Math.round((now.getTime() - start.getTime()) / 60000);
}

/**
 * Allow clock-in from (shift start − grace) until shift end (overnight-aware),
 * interpreting wall times in `timeZone`.
 */
export function isWithinClockInWindow(
  now: Date,
  startTime: string,
  endTime: string,
  graceMinutes = 15,
  timeZone = "Asia/Karachi"
) {
  const shiftDate = getShiftDate(now, startTime, endTime, timeZone);
  const overnight = isOvernight(startTime, endTime);

  const windowStart = zonedWallToUtc(shiftDate, startTime, timeZone);
  windowStart.setUTCMinutes(windowStart.getUTCMinutes() - graceMinutes);

  let endDateKey = shiftDate;
  if (overnight) endDateKey = addDaysToKey(shiftDate, 1);
  const windowEnd = zonedWallToUtc(endDateKey, endTime, timeZone);

  const t = now.getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

export function computeLateMinutes(
  now: Date,
  shiftDate: string,
  startTime: string,
  graceMinutes: number,
  timeZone = "Asia/Karachi"
) {
  const since = minutesSinceShiftStart(now, shiftDate, startTime, timeZone);
  if (since <= graceMinutes) return 0;
  return since - graceMinutes;
}

/** Resolve org timezone for shift math (workforce default Asia/Karachi). */
export function resolveOrgTimeZone(timezone?: string | null) {
  if (!timezone || timezone === "UTC") return "Asia/Karachi";
  return timezone;
}
