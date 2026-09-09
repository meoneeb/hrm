import mongoose, { Schema, models, model } from "mongoose";
import type { LeaveStatus } from "@/types";

export interface ILeave {
  userId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  typeId: mongoose.Types.ObjectId;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  decidedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema = new Schema<ILeave>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    typeId: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Leave =
  (models.Leave as mongoose.Model<ILeave>) || model<ILeave>("Leave", LeaveSchema);
