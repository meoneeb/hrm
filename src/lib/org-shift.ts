import mongoose from "mongoose";
import { Org } from "@/models/Org";
import { Shift } from "@/models/Shift";
import { User } from "@/models/User";

/** Create General 09:00–18:00 shift and set as org default if missing. */
export async function ensureOrgDefaultShift(orgId: string | mongoose.Types.ObjectId) {
  const org = await Org.findById(orgId);
  if (!org) return null;

  if (org.defaultShiftId) {
    const existing = await Shift.findById(org.defaultShiftId);
    if (existing) return existing;
  }

  let shift = await Shift.findOne({ orgId: org._id, name: "General" });
  if (!shift) {
    shift = await Shift.create({
      orgId: org._id,
      name: "General",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 15,
    });
  }

  org.defaultShiftId = shift._id as never;
  await org.save();
  return shift;
}

/** Resolve member shift or fall back to org default (ensuring one exists). */
export async function resolveEffectiveShift(userId: string, orgId: string) {
  const dbUser = await User.findById(userId);
  if (dbUser?.shiftId) {
    const personal = await Shift.findById(dbUser.shiftId);
    if (personal) return personal;
  }
  await ensureOrgDefaultShift(orgId);
  const org = await Org.findById(orgId);
  if (!org?.defaultShiftId) return null;
  return Shift.findById(org.defaultShiftId);
}
