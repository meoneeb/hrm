import mongoose, { Schema, models, model } from "mongoose";
import type { PayrollStatus } from "@/types";

export interface IPayroll {
  orgId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  status: PayrollStatus;
  generatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema = new Schema<IPayroll>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    status: { type: String, enum: ["draft", "final"], default: "final" },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PayrollSchema.index({ orgId: 1, month: 1, year: 1 }, { unique: true });

export const Payroll =
  (models.Payroll as mongoose.Model<IPayroll>) ||
  model<IPayroll>("Payroll", PayrollSchema);
