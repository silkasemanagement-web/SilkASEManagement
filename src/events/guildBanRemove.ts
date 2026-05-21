import type { GuildBan } from "discord.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { scheduleMemberCounterRefresh } from "../services/MemberCountService.js";

export const guildBanRemoveEvent = {
  name: "guildBanRemove" as const,
  async execute(ban: GuildBan) {
    const client = ban.client as ArkBotClient;
    if (!isManagedGuild(client.env, ban.guild.id)) return;
    scheduleMemberCounterRefresh(client, ban.guild.id);
  },
} satisfies BotEvent;
