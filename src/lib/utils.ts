import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function jsonOk<T>(data: T, message = "OK", status = 200) {
  return Response.json({ success: true, data, message }, { status });
}

export function jsonErr(message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, message, details }, { status });
}

export function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function workingDaysInMonth(year: number, month: number) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
