import mongoose, { Schema, models, model } from "mongoose";

export interface IPayslip {
  payrollId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  presentDays: number;
  workingDays: number;
  basic: number;
  earnings: number;
  deductions: number;
  net: number;
  breakdown: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const PayslipSchema = new Schema<IPayslip>(
  {
    payrollId: { type: Schema.Types.ObjectId, ref: "Payroll", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true },
    presentDays: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    basic: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    breakdown: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PayslipSchema.index({ payrollId: 1, userId: 1 }, { unique: true });

export const Payslip =
  (models.Payslip as mongoose.Model<IPayslip>) ||
  model<IPayslip>("Payslip", PayslipSchema);
