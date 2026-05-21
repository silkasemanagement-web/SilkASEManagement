import { Schema, model, type InferSchemaType } from "mongoose";

const pollSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true, index: true },
    creatorId: { type: String, required: true },
    question: { type: String, required: true, maxlength: 256 },
    options: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true, maxlength: 100 },
        },
      ],
      validate: [(v: unknown[]) => v.length >= 2 && v.length <= 25, "2-25 options"],
    },
    mode: { type: String, enum: ["buttons", "dropdown", "reactions"], default: "buttons" },
    anonymous: { type: Boolean, default: false },
    endsAt: { type: Date, index: true },
    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
    votes: {
      type: [
        {
          userId: { type: String, required: true },
          optionId: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

pollSchema.index({ guildId: 1, status: 1, endsAt: 1 });

export type PollDocument = InferSchemaType<typeof pollSchema> & { _id: string };
export const PollModel = model("Poll", pollSchema);
