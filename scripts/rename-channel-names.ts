import "dotenv/config";
import { ChannelType, Client, GatewayIntentBits, type GuildBasedChannel } from "discord.js";
import { getManagedGuildIds, loadEnv } from "../src/config/env.js";
import { convertCategoryName, convertChannelName } from "../src/utils/channelNaming.js";

const RENAME_TYPES = new Set<ChannelType>([
  ChannelType.GuildCategory,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

function proposedName(channel: GuildBasedChannel) {
  if (channel.type === ChannelType.GuildCategory) return convertCategoryName(channel.name);
  return convertChannelName(channel.name);
}

async function renameWithRetry(channel: GuildBasedChannel & { setName: (name: string, reason?: string) => Promise<unknown> }, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await channel.setName(name, "Normalize channel names to emoji┃name");
      return;
    } catch (err) {
      const retryAfter =
        typeof err === "object" && err !== null && "rawError" in err
          ? Number((err as { rawError?: { retry_after?: number } }).rawError?.retry_after ?? 0) * 1000
          : 0;
      if (retryAfter > 0 && attempt < 4) {
        await sleep(retryAfter + 500);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const guildArg = process.argv.find((a) => a.startsWith("--guild="))?.split("=")[1];
  const env = loadEnv();
  const guildIds = guildArg ? [guildArg] : getManagedGuildIds(env);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env.DISCORD_TOKEN);

  try {
    for (const guildId of guildIds) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        console.warn(`Skipped guild ${guildId}: not accessible`);
        continue;
      }
      await guild.channels.fetch();
      const channels = [...guild.channels.cache.values()].filter((ch) => RENAME_TYPES.has(ch.type));
      channels.sort((a, b) => ("rawPosition" in a ? a.rawPosition : 0) - ("rawPosition" in b ? b.rawPosition : 0));

      const plan: { id: string; from: string; to: string; type: string }[] = [];
      for (const channel of channels) {
        const to = proposedName(channel);
        if (!to || to === channel.name) continue;
        if (to.length < 1 || to.length > 100) {
          console.warn(`Skip ${channel.id} (${channel.name}): invalid length: ${to}`);
          continue;
        }
        plan.push({ id: channel.id, from: channel.name, to, type: ChannelType[channel.type] });
      }

      console.log(`\n=== ${guild.name} (${guild.id}) ===`);
      console.log(`${plan.length} channel(s) to rename${apply ? "" : " (dry run)"}`);
      for (const row of plan) console.log(`  [${row.type}] ${row.from}  ->  ${row.to}`);

      if (!apply) continue;

      let ok = 0;
      let fail = 0;
      for (const row of plan) {
        const ch = guild.channels.cache.get(row.id);
        if (!ch || !("setName" in ch)) continue;
        try {
          await renameWithRetry(ch as GuildBasedChannel & { setName: (name: string, reason?: string) => Promise<unknown> }, row.to);
          ok++;
          console.log(`  OK ${row.to}`);
          await sleep(3500);
        } catch (err) {
          fail++;
          console.error(`  FAILED ${row.from}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(`Renamed ${ok}, failed ${fail}`);
    }
  } finally {
    client.destroy();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
