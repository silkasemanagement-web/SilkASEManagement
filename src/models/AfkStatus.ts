import { Schema, model, type InferSchemaType } from "mongoose";

const afkStatusSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    reason: { type: String, required: true, maxlength: 512 },
    usernameSnapshot: { type: String },
    lastMentionNoticeAt: { type: Date },
  },
  { timestamps: true },
);

afkStatusSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export type AfkStatusDocument = InferSchemaType<typeof afkStatusSchema> & { _id: string };
export const AfkStatusModel = model("AfkStatus", afkStatusSchema);
