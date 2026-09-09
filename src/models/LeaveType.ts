import mongoose, { Schema, models, model } from "mongoose";

export interface ILeaveType {
  orgId: mongoose.Types.ObjectId;
  name: string;
  defaultCredits: number;
  paid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveTypeSchema = new Schema<ILeaveType>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    name: { type: String, required: true, trim: true },
    defaultCredits: { type: Number, default: 0 },
    paid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LeaveType =
  (models.LeaveType as mongoose.Model<ILeaveType>) ||
  model<ILeaveType>("LeaveType", LeaveTypeSchema);
