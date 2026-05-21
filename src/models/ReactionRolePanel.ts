import { Schema, model, type InferSchemaType } from "mongoose";

const reactionRolePanelSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true, index: true },
    mode: {
      type: String,
      enum: ["reaction", "button", "dropdown"],
      required: true,
    },
    title: { type: String, maxlength: 256 },
    description: { type: String, maxlength: 4000 },
    categoryLabel: { type: String, maxlength: 80 },
    maxRolesPerUser: { type: Number, default: 5, min: 1, max: 25 },
    exclusiveGroupIds: { type: [String], default: [] },
    entries: {
      type: [
        {
          id: { type: String, required: true },
          roleId: { type: String, required: true },
          label: { type: String, maxlength: 80 },
          emoji: { type: String },
          style: { type: String, enum: ["primary", "secondary", "success", "danger"], default: "secondary" },
          groupId: { type: String },
        },
      ],
      default: [],
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

reactionRolePanelSchema.index({ guildId: 1, channelId: 1 });

export type ReactionRolePanelDocument = InferSchemaType<typeof reactionRolePanelSchema> & {
  _id: string;
};
export const ReactionRolePanelModel = model("ReactionRolePanel", reactionRolePanelSchema);
