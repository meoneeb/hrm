import mongoose, { Schema, models, model } from "mongoose";
import type { AttendanceStatus } from "@/types";

export interface IAttendance {
  userId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  date: string;
  clockIn?: Date | null;
  clockOut?: Date | null;
  status: AttendanceStatus;
  lateMinutes: number;
  workedMinutes: number;
  note?: string;
  eod?: {
    summary: string;
    blockers?: string;
    nextPlan?: string;
    submittedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true },
    date: { type: String, required: true },
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ["present", "absent", "half_day", "leave", "holiday"],
      default: "absent",
    },
    lateMinutes: { type: Number, default: 0 },
    workedMinutes: { type: Number, default: 0 },
    note: { type: String },
    eod: {
      type: {
        summary: { type: String, required: true },
        blockers: { type: String },
        nextPlan: { type: String },
        submittedAt: { type: Date, required: true },
      },
      default: null,
    },
  },
  { timestamps: true }
);

AttendanceSchema.index({ userId: 1, orgId: 1, date: 1 }, { unique: true });

export const Attendance =
  (models.Attendance as mongoose.Model<IAttendance>) ||
  model<IAttendance>("Attendance", AttendanceSchema);
