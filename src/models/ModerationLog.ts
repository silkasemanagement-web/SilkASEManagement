import { Schema, model, type InferSchemaType } from "mongoose";

const moderationLogSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "ban",
        "unban",
        "kick",
        "timeout",
        "untimeout",
        "warn",
        "mute",
        "unmute",
        "purge",
        "slowmode",
        "lock",
        "unlock",
        "nickname",
        "role_add",
        "role_remove",
        "massrole",
        "other",
      ],
    },
    targetId: { type: String, index: true },
    moderatorId: { type: String, required: true, index: true },
    reason: { type: String, maxlength: 1024 },
    durationMs: { type: Number },
    metadata: { type: Schema.Types.Mixed, default: {} },
    evidenceUrls: { type: [String], default: [] },
    caseId: { type: String, index: true },
  },
  { timestamps: true },
);

moderationLogSchema.index({ guildId: 1, createdAt: -1 });

export type ModerationLogDocument = InferSchemaType<typeof moderationLogSchema> & { _id: string };
export const ModerationLogModel = model("ModerationLog", moderationLogSchema);
