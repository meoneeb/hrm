import mongoose, { Schema, models, model } from "mongoose";
import type { Scope, UserType } from "@/types";

export interface ICredit {
  typeId: mongoose.Types.ObjectId;
  balance: number;
}

export interface ISalary {
  basic: number;
  allowances: number;
  deductions: number;
}

export interface IUser {
  email: string;
  passHash: string;
  name: string;
  type: UserType;
  primary: boolean;
  orgId?: mongoose.Types.ObjectId | null;
  orgIds: mongoose.Types.ObjectId[];
  scope: Scope;
  projIds: mongoose.Types.ObjectId[];
  active: boolean;
  code?: string;
  designation?: string;
  joinDate?: Date;
  shiftId?: mongoose.Types.ObjectId | null;
  salary: ISalary;
  credits: ICredit[];
  createdAt: Date;
  updatedAt: Date;
}

const CreditSchema = new Schema<ICredit>(
  {
    typeId: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    balance: { type: Number, default: 0 },
  },
  { _id: false }
);

const SalarySchema = new Schema<ISalary>(
  {
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["superAdmin", "orgAdmin", "projectManager", "member"],
      required: true,
    },
    primary: { type: Boolean, default: false },
    orgId: { type: Schema.Types.ObjectId, ref: "Org", default: null },
    orgIds: [{ type: Schema.Types.ObjectId, ref: "Org" }],
    scope: { type: String, enum: ["org", "projects"], default: "org" },
    projIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
    active: { type: Boolean, default: true },
    code: { type: String, trim: true },
    designation: { type: String, trim: true },
    joinDate: { type: Date },
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", default: null },
    salary: { type: SalarySchema, default: () => ({}) },
    credits: { type: [CreditSchema], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ type: 1, primary: 1 });
UserSchema.index({ orgIds: 1 });
UserSchema.index({ orgId: 1 });

export const User =
  (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
