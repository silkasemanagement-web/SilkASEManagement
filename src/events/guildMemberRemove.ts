import type { GuildMember, PartialGuildMember } from "discord.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { scheduleMemberCounterRefresh } from "../services/MemberCountService.js";

export const guildMemberRemoveEvent = {
  name: "guildMemberRemove" as const,
  async execute(member: GuildMember | PartialGuildMember) {
    const client = member.client as ArkBotClient;
    if (!isManagedGuild(client.env, member.guild.id)) return;
    scheduleMemberCounterRefresh(client, member.guild.id);
  },
} satisfies BotEvent;
