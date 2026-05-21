import { Schema, model, type InferSchemaType } from "mongoose";

const ticketSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    ticketNumber: { type: Number, required: true, index: true },
    channelId: { type: String, required: true, unique: true, index: true },
    openerId: { type: String, required: true, index: true },
    categoryKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["open", "claimed", "closed", "locked", "archived"],
      default: "open",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
    locked: { type: Boolean, default: false },
    claimedById: { type: String, index: true },
    tags: { type: [String], default: [] },
    participants: { type: [String], default: [] },
    staffNotes: { type: [String], default: [] },
    openedVia: { type: String, enum: ["panel", "slash", "button", "modal"], default: "panel" },
    panelName: { type: String },
    transcriptHtmlPath: { type: String },
    transcriptMessageUrl: { type: String },
    closedById: { type: String },
    closeReason: { type: String, maxlength: 1024 },
    lastActivityAt: { type: Date, default: () => new Date(), index: true },
    analytics: {
      firstStaffResponseAt: { type: Date },
      messageCount: { type: Number, default: 0 },
      staffResponseCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

ticketSchema.index({ guildId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ guildId: 1, openerId: 1, status: 1 });
ticketSchema.index({ guildId: 1, status: 1, updatedAt: -1 });

export type TicketDocument = InferSchemaType<typeof ticketSchema> & { _id: string };
export const TicketModel = model("Ticket", ticketSchema);
