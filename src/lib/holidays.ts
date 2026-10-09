import { Holiday } from "@/models/Holiday";
import { workingDaysInMonth } from "@/lib/utils";

function monthPrefix(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isWeekdayDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dow = new Date(y, m - 1, d).getDay();
  return dow !== 0 && dow !== 6;
}

/** Holiday dates (YYYY-MM-DD) for an org in a given month. */
export async function listOrgHolidayDates(
  orgId: string,
  year: number,
  month: number
) {
  const prefix = monthPrefix(year, month);
  const rows = await Holiday.find({
    orgId,
    date: { $regex: `^${prefix}` },
  })
    .sort({ date: 1 })
    .lean();
  return rows.map((r) => r.date);
}

/**
 * Mon–Fri days in month minus org holidays that fall on weekdays.
 */
export async function workingDaysForOrg(
  orgId: string,
  year: number,
  month: number
) {
  const base = workingDaysInMonth(year, month);
  const holidays = await listOrgHolidayDates(orgId, year, month);
  const weekdayHolidays = holidays.filter(isWeekdayDateKey).length;
  return Math.max(0, base - weekdayHolidays);
}
