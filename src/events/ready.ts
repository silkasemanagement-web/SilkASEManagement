import type { BotEvent } from "../interfaces/IEvent.js";
import type { Client } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { getManagedGuildIds } from "../config/env.js";
import { startCronHub } from "../scheduler/cronHub.js";
import { startPeriodicTasks } from "../scheduler/periodicTasks.js";

export const readyEvent = {
  name: "ready" as const,
  once: true,
  async execute(client: Client<true>) {
    const bot = client as ArkBotClient;
    bot.log.info(
      { tag: bot.user?.tag, guilds: bot.guilds.cache.size, pid: process.pid, nodeEnv: bot.env.NODE_ENV },
      "Bot online — SILK ASE PS4/PS5 management stack initialized",
    );
    if (bot.cache.isMemoryMode) {
      bot.log.warn(
        "REDIS_URL=memory://local — bot only runs while this machine is online. For 24/7 uptime set cloud REDIS_URL and deploy to VPS/Railway (see HOSTING-24-7.md).",
      );
    }
    for (const id of getManagedGuildIds(bot.env)) {
      const g = bot.guilds.cache.get(id);
      if (!g) {
        bot.log.warn({ id }, "Managed guild not visible to this shard — check intents and invites");
        continue;
      }
      void bot.config.getGuild(id).catch((err) => bot.log.warn({ err, guildId: id }, "Guild config prewarm failed"));
    }
    startCronHub(bot);
    startPeriodicTasks(bot);
    await seedCommandOnlyChannels(bot);
  },
} satisfies BotEvent;

async function seedCommandOnlyChannels(bot: ArkBotClient) {
  const defaults = [bot.env.DEFAULT_COMMANDS_CHANNEL_ID, bot.env.SUGGESTION_COMMAND_CHANNEL_ID].filter(
    (id): id is string => Boolean(id),
  );
  if (!defaults.length) return;

  for (const guildId of getManagedGuildIds(bot.env)) {
    const cfg = await bot.config.getGuild(guildId);
    const current = cfg.commandOnlyChannelIds ?? [];
    const merged = [...new Set([...current, ...defaults])];
    if (merged.length === current.length) continue;
    await bot.config.updateGuild(guildId, { commandOnlyChannelIds: merged } as never);
    bot.log.info({ guildId, channels: merged }, "Seeded commands-only channels");
  }
}