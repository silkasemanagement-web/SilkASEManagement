import { Schema, model, type InferSchemaType } from "mongoose";

const suggestionSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true, index: true },
    threadId: { type: String },
    authorId: { type: String },
    anonymous: { type: Boolean, default: false },
    content: { type: String, required: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["in_review", "approved", "denied", "implemented"],
      default: "in_review",
      index: true,
    },
    staffNote: { type: String, maxlength: 1024 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

suggestionSchema.index({ guildId: 1, status: 1, createdAt: -1 });

export type SuggestionDocument = InferSchemaType<typeof suggestionSchema> & { _id: string };
export const SuggestionModel = model("Suggestion", suggestionSchema);
