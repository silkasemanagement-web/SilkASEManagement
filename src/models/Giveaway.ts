import { Schema, model, type InferSchemaType } from "mongoose";

const giveawaySchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, index: true },
    hostId: { type: String, required: true },
    prize: { type: String, required: true, maxlength: 256 },
    description: { type: String, maxlength: 4000 },
    endsAt: { type: Date, required: true, index: true },
    winnerCount: { type: Number, default: 1, min: 1, max: 20 },
    requiredRoleIds: { type: [String], default: [] },
    bonusRoleIds: { type: [String], default: [] },
    inviteRequirement: { type: Number, default: 0 },
    boosterBonusEntries: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "ended", "cancelled"], default: "active", index: true },
    entrants: { type: [String], default: [] },
    winnerIds: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

giveawaySchema.index({ guildId: 1, status: 1, endsAt: 1 });

export type GiveawayDocument = InferSchemaType<typeof giveawaySchema> & { _id: string };
export const GiveawayModel = model("Giveaway", giveawaySchema);
