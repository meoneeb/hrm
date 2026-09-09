import mongoose, { Schema, models, model } from "mongoose";

export interface IOrg {
  name: string;
  code: string;
  timezone: string;
  status: "active" | "inactive";
  currency: string;
  secondaryCurrency?: string | null;
  fxRate: number;
  defaultShiftId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrgSchema = new Schema<IOrg>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    timezone: { type: String, default: "Asia/Karachi" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    currency: { type: String, default: "PKR", uppercase: true, trim: true },
    secondaryCurrency: { type: String, default: null, uppercase: true, trim: true },
    fxRate: { type: Number, default: 1, min: 0 },
    defaultShiftId: { type: Schema.Types.ObjectId, ref: "Shift", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Org = (models.Org as mongoose.Model<IOrg>) || model<IOrg>("Org", OrgSchema);
