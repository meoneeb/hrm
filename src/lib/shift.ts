/** Time helpers for overnight-aware shift dates (local wall clock). */

export function parseTimeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isOvernight(startTime: string, endTime: string) {
  return parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime);
}

export function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToKey(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toLocalDateKey(dt);
}

/**
 * Shift start calendar day for `now`.
 * Overnight e.g. 21:00–01:00: between 00:00 and endTime → yesterday.
 */
export function getShiftDate(
  now: Date,
  startTime: string,
  endTime: string
): string {
  const today = toLocalDateKey(now);
  if (!isOvernight(startTime, endTime)) return today;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const endMin = parseTimeToMinutes(endTime);
  if (nowMin < endMin) return addDaysToKey(today, -1);
  return today;
}

/** Minutes from shift start on shiftDate to `now` (can span midnight). */
export function minutesSinceShiftStart(
  now: Date,
  shiftDate: string,
  startTime: string
) {
  const [y, m, d] = shiftDate.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const start = new Date(y, m - 1, d, sh || 0, sm || 0, 0, 0);
  return Math.round((now.getTime() - start.getTime()) / 60000);
}

/**
 * Allow clock-in from shift start until shift end (overnight-aware).
 * Small early window: graceMinutes before start.
 */
export function isWithinClockInWindow(
  now: Date,
  startTime: string,
  endTime: string,
  graceMinutes = 15
) {
  const shiftDate = getShiftDate(now, startTime, endTime);
  const [y, m, d] = shiftDate.split("-").map(Number);
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const overnight = isOvernight(startTime, endTime);

  const windowStart = new Date(
    y,
    m - 1,
    d,
    Math.floor(startMin / 60),
    startMin % 60,
    0,
    0
  );
  windowStart.setMinutes(windowStart.getMinutes() - graceMinutes);

  const windowEnd = new Date(
    y,
    m - 1,
    d,
    Math.floor(endMin / 60),
    endMin % 60,
    0,
    0
  );
  if (overnight) {
    windowEnd.setDate(windowEnd.getDate() + 1);
  }

  const t = now.getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

export function computeLateMinutes(
  now: Date,
  shiftDate: string,
  startTime: string,
  graceMinutes: number
) {
  const since = minutesSinceShiftStart(now, shiftDate, startTime);
  if (since <= graceMinutes) return 0;
  return since - graceMinutes;
}
