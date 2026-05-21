import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { readTickets } from "../core/guildConfigFields.js";
import { TicketRepository } from "./repository.js";
import { TicketService } from "./service.js";
import { DEFAULT_AUTO_CLOSE_HOURS } from "./constants.js";

export async function runTicketInactivitySweep(client: ArkBotClient) {
  for (const guild of client.guilds.cache.values()) {
    if (!isManagedGuild(client.env, guild.id)) continue;
    const cfg = await client.config.getGuild(guild.id);
    const tickets = readTickets(cfg);
    const hours = tickets.autoCloseInactiveHours ?? DEFAULT_AUTO_CLOSE_HOURS;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const stale = await TicketRepository.findInactive(guild.id, cutoff);
    if (!stale.length) continue;

    const svc = new TicketService(client);
    for (const doc of stale) {
      const channel = await guild.channels.fetch(doc.channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        await TicketRepository.setStatus(doc.channelId, "archived");
        continue;
      }
      await svc.closeTicket({
        guild,
        channel,
        closedById: client.user?.id ?? guild.id,
        reason: `Auto-closed after ${hours}h inactivity`,
        requesterId: client.user?.id ?? guild.id,
        isStaff: true,
      });
      client.log.info({ channelId: doc.channelId, guildId: guild.id }, "Ticket auto-closed (inactivity)");
    }
  }
}
