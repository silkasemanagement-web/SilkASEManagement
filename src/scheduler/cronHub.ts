import cron from "node-cron";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";
import { MiniGameHostService } from "../services/MiniGameHostService.js";
import { runTicketInactivitySweep } from "../tickets/automation.js";

function resolveMiniGameChannelId(cfg: GuildConfigurationDocument) {
  const ev = cfg.events;
  const mini =
    ev && typeof ev === "object" && "miniGameChannelId" in ev ? ev.miniGameChannelId : undefined;
  return mini ?? cfg.modLogChannelId ?? undefined;
}

/** Schedules recurring ARK mini-games (staggered) for managed guilds. */
export function startCronHub(client: ArkBotClient) {
  const mini = new MiniGameHostService(client.cache);

  cron.schedule("0 */6 * * *", async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!isManagedGuild(client.env, guild.id)) continue;
      const cfg = await client.config.getGuild(guild.id);
      const id = resolveMiniGameChannelId(cfg);
      if (!id) continue;
      const ch = await guild.channels.fetch(id).catch(() => null);
      if (!ch?.isTextBased()) continue;
      try {
        await mini.hostNumberGuess(ch, 10);
      } catch (err) {
        client.log.error({ err, guildId: guild.id }, "Scheduled number event failed");
      }
    }
  });

  cron.schedule("0 * * * *", async () => {
    try {
      await runTicketInactivitySweep(client);
    } catch (err) {
      client.log.error({ err }, "Ticket inactivity sweep failed");
    }
  });

  cron.schedule("30 */6 * * *", async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!isManagedGuild(client.env, guild.id)) continue;
      const cfg = await client.config.getGuild(guild.id);
      const id = resolveMiniGameChannelId(cfg);
      if (!id) continue;
      const ch = await guild.channels.fetch(id).catch(() => null);
      if (!ch?.isTextBased()) continue;
      try {
        await mini.hostDinoScramble(ch, 10);
      } catch (err) {
        client.log.error({ err, guildId: guild.id }, "Scheduled dino event failed");
      }
    }
  });
}
