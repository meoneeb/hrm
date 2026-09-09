import mongoose, { Schema, models, model } from "mongoose";

export interface IShift {
  orgId: mongoose.Types.ObjectId;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    graceMinutes: { type: Number, default: 15 },
  },
  { timestamps: true }
);

export const Shift =
  (models.Shift as mongoose.Model<IShift>) || model<IShift>("Shift", ShiftSchema);
