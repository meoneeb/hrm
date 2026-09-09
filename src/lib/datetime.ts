const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

function asDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sept 9, 2026 */
export function formatDate(value: Date | string | number | null | undefined) {
  const d = asDate(value);
  if (!d) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 09:00 PM */
export function formatTime(value: Date | string | number | null | undefined) {
  const d = asDate(value);
  if (!d) return "—";
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

/** Sept 9, 2026 | 09:00 PM */
export function formatDateTime(value: Date | string | number | null | undefined) {
  const d = asDate(value);
  if (!d) return "—";
  return `${formatDate(d)} | ${formatTime(d)}`;
}

/** Parse YYYY-MM-DD as local date for display */
export function formatDateKey(dateKey: string | null | undefined) {
  if (!dateKey) return "—";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return formatDate(dateKey);
  return formatDate(new Date(y, m - 1, d));
}

/** Format HH:mm shift wall time as 09:00 PM */
export function formatShiftTime(hhmm: string) {
  const [hs, ms] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(hs || 0, ms || 0, 0, 0);
  return formatTime(d);
}
