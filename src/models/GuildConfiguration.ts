import { Schema, model, type InferSchemaType } from "mongoose";

const embedTemplateSchema = new Schema(
  {
    title: { type: String },
    description: { type: String },
    color: { type: Number },
    thumbnailUrl: { type: String },
    imageUrl: { type: String },
    footerText: { type: String },
    authorName: { type: String },
    authorIconUrl: { type: String },
  },
  { _id: false },
);

const guildConfigurationSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    staffRoleIds: { type: [String], default: [] },
    adminRoleIds: { type: [String], default: [] },
    helperRoleIds: { type: [String], default: [] },
    eventManagerRoleIds: { type: [String], default: [] },
    modLogChannelId: { type: String },
    auditLogChannelId: { type: String },
    alertRoleIds: { type: [String], default: [] },
    commandOnlyChannelIds: { type: [String], default: [] },
    welcome: {
      enabled: { type: Boolean, default: false },
      joinChannelId: { type: String },
      leaveChannelId: { type: String },
      joinEmbed: { type: embedTemplateSchema },
      leaveEmbed: { type: embedTemplateSchema },
      autoRoleIds: { type: [String], default: [] },
      nicknameFormat: { type: String, maxlength: 32 },
      joinComponents: { type: Schema.Types.Mixed },
    },
    stats: {
      memberChannelId: { type: String },
      onlineChannelId: { type: String },
      boostChannelId: { type: String },
      botChannelId: { type: String },
      voiceActivityChannelId: { type: String },
      subscriberChannelId: { type: String },
      updateIntervalMs: { type: Number, default: 15_000 },
      memberCounters: {
        type: [
          {
            channelId: { type: String, required: true },
            type: { type: String, required: true },
            parentCategoryId: { type: String },
          },
        ],
        default: [],
      },
    },
    automod: {
      enabled: { type: Boolean, default: true },
      antiSpam: { type: Boolean, default: true },
      spamThreshold: { type: Number, default: 6 },
      spamIntervalMs: { type: Number, default: 7000 },
      antiRaid: { type: Boolean, default: true },
      raidJoinsPer10s: { type: Number, default: 12 },
      antiMassMention: { type: Boolean, default: true },
      massMentionThreshold: { type: Number, default: 5 },
      antiScamLinks: { type: Boolean, default: true },
      antiInvites: { type: Boolean, default: true },
      antiGhostPing: { type: Boolean, default: true },
      autoTimeoutMinutes: { type: Number, default: 10 },
      warnEscalation: { type: Boolean, default: true },
    },
    tickets: {
      panelChannelId: { type: String },
      panelMessageId: { type: String },
      categories: {
        type: Map,
        of: String,
        default: {},
      },
      transcriptLogChannelId: { type: String },
      autoCloseInactiveHours: { type: Number, default: 72 },
      maxOpenPerUser: { type: Number, default: 3 },
      welcomeMessage: { type: String, maxlength: 2000 },
      staffRoleIds: { type: [String], default: [] },
    },
    suggestions: {
      channelId: { type: String },
      commandChannelId: { type: String },
      anonymousAllowed: { type: Boolean, default: true },
      threadPerSuggestion: { type: Boolean, default: true },
    },
    scheduling: {
      arkRestartCron: { type: String },
      wipeAnnounceCron: { type: String },
      donationReminderCron: { type: String },
      eventNumberCron: { type: String, default: "0 */6 * * *" },
      eventDinoCron: { type: String, default: "0 */6 * * *" },
    },
    embedTheme: { type: String, default: "ark" },
    colorRoles: {
      menuChannelId: { type: String },
      menuMessageId: { type: String },
      palette: {
        type: [
          {
            hex: { type: String, required: true },
            roleId: { type: String },
            label: { type: String },
          },
        ],
        default: [],
      },
    },
    logging: {
      messageDeleteChannelId: { type: String },
      messageEditChannelId: { type: String },
      memberJoinChannelId: { type: String },
      memberLeaveChannelId: { type: String },
      voiceChannelId: { type: String },
      roleChannelId: { type: String },
      channelChannelId: { type: String },
      nicknameChannelId: { type: String },
    },
    backups: {
      lastRunAt: { type: Date },
      webhookUrl: { type: String },
    },
    security: {
      antiNukeEnabled: { type: Boolean, default: true },
      verificationEnabled: { type: Boolean, default: false },
    },
    jail: {
      roleId: { type: String },
      channelId: { type: String },
      categoryId: { type: String },
    },
    economy: {
      dailyReward: { type: Number, default: 250 },
      weeklyReward: { type: Number, default: 1000 },
    },
    events: {
      /** Preferred channel for auto-hosted mini-games (cron). Falls back to welcome.joinChannelId or modLogChannelId. */
      miniGameChannelId: { type: String },
      eventChannelId: { type: String },
      defaultNumberReward: { type: String },
      defaultDinoReward: { type: String },
    },
  },
  { timestamps: true },
);

export type GuildConfigurationDocument = InferSchemaType<typeof guildConfigurationSchema> & {
  _id: string;
};
export const GuildConfigurationModel = model("GuildConfiguration", guildConfigurationSchema);
