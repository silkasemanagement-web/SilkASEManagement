import { Schema, model, type InferSchemaType } from "mongoose";

const jailRecordSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    usernameSnapshot: { type: String },
    jailRoleId: { type: String, required: true },
    jailChannelId: { type: String, required: true },
    previousRoleIds: { type: [String], default: [] },
    jailedById: { type: String, required: true },
    unjailedById: { type: String },
    reason: { type: String, maxlength: 512 },
    status: { type: String, enum: ["jailed", "released"], default: "jailed", index: true },
    releasedAt: { type: Date },
  },
  { timestamps: true },
);

jailRecordSchema.index({ guildId: 1, userId: 1, status: 1 });

export type JailRecordDocument = InferSchemaType<typeof jailRecordSchema> & { _id: string };
export const JailRecordModel = model("JailRecord", jailRecordSchema);
