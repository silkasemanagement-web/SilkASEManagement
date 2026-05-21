import { Schema, model, type InferSchemaType } from "mongoose";

const botGameEventSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["number_guess", "dino_scramble", "voice_last_leave", "custom"],
      required: true,
    },
    channelId: { type: String, required: true },
    hostMessageId: { type: String },
    status: {
      type: String,
      enum: ["scheduled", "running", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    scheduledFor: { type: Date, index: true },
    startedAt: { type: Date },
    endsAt: { type: Date },
    payload: { type: Schema.Types.Mixed, default: {} },
    winnerUserIds: { type: [String], default: [] },
    analytics: {
      participants: { type: Number, default: 0 },
      guesses: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

botGameEventSchema.index({ guildId: 1, status: 1, endsAt: 1 });

export type BotGameEventDocument = InferSchemaType<typeof botGameEventSchema> & { _id: string };
export const BotGameEventModel = model("BotGameEvent", botGameEventSchema);
