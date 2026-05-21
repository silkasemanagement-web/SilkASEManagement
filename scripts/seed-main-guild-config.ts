import "dotenv/config";
import mongoose from "mongoose";
import { GuildConfigurationModel } from "../src/models/GuildConfiguration.js";

const MAIN_GUILD_ID = "1154868322140180622";
const DONATION_GUILD_ID = "1196105674099281982";

const adminRoleIds = [
  "1239401981068705822", // owner
  "1493482586570231898", // lead manager
  "1493482587228995665", // lead manager
  "1493482595303035012", // lead admin
  "1493482604341624944", // admin
];

const chatModRoleId = "1493482605884997682";
const alertRoleId = "1493482594606649374";
const maxAuditLogChannelId = "1239402379602825320";

const mainGuildConfig = {
  guildId: MAIN_GUILD_ID,
  staffRoleIds: [...adminRoleIds, chatModRoleId],
  adminRoleIds,
  helperRoleIds: [chatModRoleId],
  eventManagerRoleIds: [
    "1493482586570231898",
    "1493482587228995665",
    "1493482595303035012",
    "1493482604341624944",
  ],
  alertRoleIds: [alertRoleId],
  modLogChannelId: maxAuditLogChannelId,
  auditLogChannelId: maxAuditLogChannelId,
  welcome: {},
  tickets: {
    transcriptLogChannelId: "1493483003916058644",
    autoCloseInactiveHours: 72,
    staffRoleIds: [...adminRoleIds, chatModRoleId],
    categories: {
      discord_support: "1506860774201495582",
      news_support: "1506860814353830019",
      mesh_support: "1506860845127438416",
      mesh_foundation_support: "1506860884234866709",
      donation_support: "1505106775035347036",
      player_reports: "1493482953269837825",
      admin_help: "1493482950551928833",
      appeals: "1493482949054566440",
      purchase_support: "1505106810170769469",
      event_rewards: "1493482951793446993",
    },
  },
  suggestions: {
    channelId: "1493483244061065317",
    anonymousAllowed: true,
    threadPerSuggestion: true,
  },
  events: {
    eventChannelId: "1493483236855251025",
    miniGameChannelId: "1493483232006766604",
    defaultNumberReward: "ASE PS4/PS5 event reward ticket",
    defaultDinoReward: "ASE PS4/PS5 dino event reward ticket",
  },
  scheduling: {
    eventNumberCron: "0 */6 * * *",
    eventDinoCron: "30 */6 * * *",
  },
  logging: {
    messageDeleteChannelId: maxAuditLogChannelId,
    messageEditChannelId: maxAuditLogChannelId,
    memberJoinChannelId: maxAuditLogChannelId,
    memberLeaveChannelId: maxAuditLogChannelId,
    voiceChannelId: maxAuditLogChannelId,
    roleChannelId: maxAuditLogChannelId,
    channelChannelId: maxAuditLogChannelId,
    nicknameChannelId: maxAuditLogChannelId,
  },
  stats: {
    updateIntervalMs: 15_000,
    memberCounters: [],
  },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required in .env before seeding config.");

  await mongoose.connect(uri);
  await GuildConfigurationModel.findOneAndUpdate(
    { guildId: MAIN_GUILD_ID },
    { $set: mainGuildConfig },
    { upsert: true, new: true },
  );

  await GuildConfigurationModel.findOneAndUpdate(
    { guildId: DONATION_GUILD_ID },
    {
      $setOnInsert: {
        guildId: DONATION_GUILD_ID,
        staffRoleIds: [],
        adminRoleIds: [],
        helperRoleIds: [],
        eventManagerRoleIds: [],
        alertRoleIds: [],
      },
    },
    { upsert: true, new: true },
  );

  await mongoose.disconnect();
  console.log("Guild configuration seeded.");
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
