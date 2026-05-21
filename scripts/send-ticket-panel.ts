import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AttachmentBuilder, Client, GatewayIntentBits, Routes, type APIEmoji } from "discord.js";
import mongoose from "mongoose";
import { loadEnv } from "../src/config/env.js";
import type { TicketCategoryKey } from "../src/config/constants.js";
import { GuildConfigurationModel } from "../src/models/GuildConfiguration.js";
import { TICKET_PANEL_IMAGE_ATTACHMENT } from "../src/tickets/constants.js";
import { buildTicketPanelEmbed, buildTicketPanelMenu } from "../src/tickets/panel.js";

const PANEL_CHANNEL_ID = "1505800192249561110";
const MAIN_GUILD_ID = "1154868322140180622";

/** Parent Discord categories for each ticket type */
const TICKET_PARENT_CATEGORIES: Partial<Record<TicketCategoryKey, string>> = {
  discord_support: "1506860774201495582",
  news_support: "1506860814353830019",
  mesh_support: "1506860845127438416",
  mesh_foundation_support: "1506860884234866709",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_IMAGE_CANDIDATES = [
  path.join(__dirname, "..", "assets", "ticket-panel-cover.png"),
  path.join(
    process.cwd(),
    "assets",
    "c__Users_Trova_AppData_Roaming_Cursor_User_workspaceStorage_c9a9f2e1cd2b895b4baf3759e684b023_images_Silk_tickettool-removebg-preview-a1d8a51f-e1eb-4f47-903f-b7b6bf7ff241.png",
  ),
  "C:\\Users\\Trova\\.cursor\\projects\\c-Users-Trova-OneDrive-Documents-ark-enterprise-discord-bot\\assets\\c__Users_Trova_AppData_Roaming_Cursor_User_workspaceStorage_c9a9f2e1cd2b895b4baf3759e684b023_images_Silk_tickettool-removebg-preview-a1d8a51f-e1eb-4f47-903f-b7b6bf7ff241.png",
];

async function main() {
  const env = loadEnv();
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers],
  });
  await client.login(env.DISCORD_TOKEN);

  try {
    const guild = await client.guilds.fetch(MAIN_GUILD_ID);
    const apiEmojis = (await client.rest.get(Routes.guildEmojis(MAIN_GUILD_ID))) as APIEmoji[];
    const emojiLookup = new Map(apiEmojis.filter((emoji) => emoji.name).map((emoji) => [emoji.name!, emoji]));
    const channel = await guild.channels.fetch(PANEL_CHANNEL_ID);
    if (!channel?.isTextBased() || !("send" in channel)) {
      throw new Error(`Channel ${PANEL_CHANNEL_ID} is missing or not a text channel.`);
    }

    let oldPanelId: string | undefined;
    if (env.MONGODB_URI) {
      await mongoose.connect(env.MONGODB_URI);
      const cfg = await GuildConfigurationModel.findOne({ guildId: MAIN_GUILD_ID }).lean();
      const current = (cfg?.tickets?.categories as Record<string, string> | undefined) ?? {};
      oldPanelId = cfg?.tickets?.panelMessageId ?? undefined;
      await GuildConfigurationModel.updateOne(
        { guildId: MAIN_GUILD_ID },
        {
          $set: {
            "tickets.panelChannelId": PANEL_CHANNEL_ID,
            "tickets.categories": { ...current, ...TICKET_PARENT_CATEGORIES },
          },
        },
        { upsert: true },
      );
      console.log("Updated ticket category mappings in guild config.");
    }

    const coverPath = COVER_IMAGE_CANDIDATES.find((candidate) => existsSync(candidate));
    if (!coverPath) throw new Error("Ticket panel cover image not found on disk.");
    const attachment = new AttachmentBuilder(coverPath, { name: TICKET_PANEL_IMAGE_ATTACHMENT });

    for (const messageId of [oldPanelId, "1506859510885519411"]) {
      if (!messageId) continue;
      const old = await channel.messages.fetch(messageId).catch(() => null);
      if (old && old.author.id === client.user?.id) await old.delete().catch(() => null);
    }

    const message = await channel.send({
      files: [attachment],
      embeds: [buildTicketPanelEmbed()],
      components: [buildTicketPanelMenu(guild, emojiLookup)],
    });

    if (env.MONGODB_URI) {
      await GuildConfigurationModel.updateOne(
        { guildId: MAIN_GUILD_ID },
        { $set: { "tickets.panelMessageId": message.id } },
      );
      await mongoose.disconnect();
    }

    console.log(`Ticket panel sent to #${channel.name} (${channel.id})`);
    console.log(`Message URL: ${message.url}`);
  } finally {
    client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
