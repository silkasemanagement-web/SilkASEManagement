import { Schema, model, type InferSchemaType } from "mongoose";

const userProfileSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    usernameSnapshot: { type: String },
    joinedAt: { type: Date },
    lastSeenAt: { type: Date },
    messageCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    suggestionCount: { type: Number, default: 0 },
    appealOpen: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

userProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export type UserProfileDocument = InferSchemaType<typeof userProfileSchema> & { _id: string };
export const UserProfileModel = model("UserProfile", userProfileSchema);
