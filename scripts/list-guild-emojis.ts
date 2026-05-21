import "dotenv/config";
import { Client, GatewayIntentBits, Routes } from "discord.js";
import { loadEnv } from "../src/config/env.js";

async function main() {
  const env = loadEnv();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env.DISCORD_TOKEN);
  const emojis = (await client.rest.get(Routes.guildEmojis(env.MAIN_GUILD_ID))) as Array<{ name: string; id: string }>;
  for (const emoji of emojis.sort((a, b) => a.name.localeCompare(b.name))) {
    const lower = emoji.name.toLowerCase();
    if (/news|teleport|foundation|silk|logo/.test(lower)) console.log(`${emoji.name} (${emoji.id})`);
  }
  client.destroy();
}

main();
