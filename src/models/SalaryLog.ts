import mongoose, { Schema, models, model } from "mongoose";

export type SalarySnapshot = {
  basic: number;
  allowances: number;
  deductions: number;
};

export interface ISalaryLog {
  userId: mongoose.Types.ObjectId;
  orgId?: mongoose.Types.ObjectId | null;
  changedBy: mongoose.Types.ObjectId;
  before: SalarySnapshot;
  after: SalarySnapshot;
  deltaBasic: number;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotSchema = new Schema<SalarySnapshot>(
  {
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
  },
  { _id: false }
);

const SalaryLogSchema = new Schema<ISalaryLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Org", default: null },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    before: { type: SnapshotSchema, required: true },
    after: { type: SnapshotSchema, required: true },
    deltaBasic: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SalaryLogSchema.index({ userId: 1, createdAt: -1 });

export const SalaryLog =
  (models.SalaryLog as mongoose.Model<ISalaryLog>) ||
  model<ISalaryLog>("SalaryLog", SalaryLogSchema);
