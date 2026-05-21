import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadEnv } from "../src/config/env.js";
import { allCommands } from "../src/commands/registry.js";

const env = loadEnv();
const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
const names = new Set<string>();
const body = allCommands.map((c) => {
  const data = typeof c.data === "function" ? c.data() : c.data;
  if (names.has(data.name)) {
    throw new Error(`Duplicate slash command in deploy list: ${data.name}`);
  }
  names.add(data.name);
  return data.toJSON();
});

await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: [] });
console.log("Cleared global application commands to prevent duplicates.");

const guildIds = env.DEV_GUILD_ID
  ? [env.DEV_GUILD_ID]
  : [env.MAIN_GUILD_ID, env.DONATION_GUILD_ID];

for (const guildId of guildIds) {
  try {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body });
    console.log(`Deployed ${body.length} guild commands to ${guildId}`);
  } catch (err) {
    console.warn(`Skipped guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
