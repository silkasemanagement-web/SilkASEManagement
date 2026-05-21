import { Schema, model, type InferSchemaType } from "mongoose";

export const DONATION_METHODS = [
  "paypal",
  "venmo",
  "playstation_gift_card",
  "cash_app",
  "discord_boost",
  "visa_gift_card",
] as const;

const donationLedgerSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    usernameSnapshot: { type: String },
    amount: { type: Number, required: true },
    method: { type: String, enum: DONATION_METHODS, required: true },
    note: { type: String, maxlength: 512 },
    action: { type: String, enum: ["add", "remove"], required: true },
    moderatorId: { type: String, required: true },
  },
  { timestamps: true },
);

donationLedgerSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

export type DonationLedgerDocument = InferSchemaType<typeof donationLedgerSchema> & { _id: string };
export const DonationLedgerModel = model("DonationLedger", donationLedgerSchema);
