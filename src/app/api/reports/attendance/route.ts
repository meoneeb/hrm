import { dbConnect } from "@/lib/db";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { requireUser, assertOrgAccess } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import {
  listOrgHolidayDates,
  workingDaysForOrg,
} from "@/lib/holidays";

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());
  const userIdsParam = url.searchParams.get("userIds");

  if (!orgId) return jsonErr("orgId required");
  const denied = assertOrgAccess(user!, orgId);
  if (denied) return denied;

  const filterIds = userIdsParam
    ? userIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  await dbConnect();

  const staffFilter: Record<string, unknown> = {
    orgId,
    type: { $in: ["member", "projectManager"] },
    active: true,
  };
  if (filterIds.length) {
    staffFilter._id = { $in: filterIds };
  }

  const staff = await User.find(staffFilter).sort({ name: 1 });
  const staffIds = staff.map((s) => s._id);

  const rows = await Attendance.find({
    orgId,
    userId: { $in: staffIds },
    date: { $regex: `^${prefix}` },
  });

  const byUser = new Map<
    string,
    {
      present: number;
      absent: number;
      half_day: number;
      leave: number;
      holiday: number;
      total: number;
    }
  >();

  for (const s of staff) {
    byUser.set(String(s._id), {
      present: 0,
      absent: 0,
      half_day: 0,
      leave: 0,
      holiday: 0,
      total: 0,
    });
  }

  for (const row of rows) {
    const key = String(row.userId);
    const bucket = byUser.get(key);
    if (!bucket) continue;
    const status = row.status as keyof typeof bucket;
    if (status in bucket && status !== "total") {
      bucket[status] += 1;
    }
    bucket.total += 1;
  }

  const workingDays = await workingDaysForOrg(orgId, year, month);
  const holidays = await listOrgHolidayDates(orgId, year, month);

  const members = staff.map((s) => {
    const counts = byUser.get(String(s._id))!;
    return {
      userId: String(s._id),
      name: s.name,
      ...counts,
    };
  });

  return jsonOk({
    month,
    year,
    workingDays,
    holidays,
    members,
  });
}
