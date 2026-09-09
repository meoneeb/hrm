import mongoose, { Schema, models, model } from "mongoose";

export interface IProject {
  orgId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  managerIds: mongoose.Types.ObjectId[];
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Org", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    managerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

ProjectSchema.index({ orgId: 1, code: 1 }, { unique: true });

export const Project =
  (models.Project as mongoose.Model<IProject>) ||
  model<IProject>("Project", ProjectSchema);
