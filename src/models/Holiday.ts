import mongoose, { Schema, models, model } from "mongoose";

export interface IHoliday {
  orgId: mongoose.Types.ObjectId;
  date: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, trim: true },
  },
  { timestamps: true }
);

HolidaySchema.index({ orgId: 1, date: 1 }, { unique: true });

export const Holiday =
  (models.Holiday as mongoose.Model<IHoliday>) ||
  model<IHoliday>("Holiday", HolidaySchema);
