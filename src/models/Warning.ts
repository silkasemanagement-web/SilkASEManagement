import { Schema, model, type InferSchemaType } from "mongoose";

const warningSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 1024 },
    weight: { type: Number, default: 1, min: 1, max: 5 },
    evidenceUrls: { type: [String], default: [] },
    appealTicketId: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

warningSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

export type WarningDocument = InferSchemaType<typeof warningSchema> & { _id: string };
export const WarningModel = model("Warning", warningSchema);
