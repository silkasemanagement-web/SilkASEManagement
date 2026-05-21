import type { GuildMember, PartialGuildMember } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import { scheduleMemberCounterRefresh } from "../services/MemberCountService.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";

export const guildMemberUpdateEvent = {
  name: "guildMemberUpdate" as const,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const client = newMember.client as ArkBotClient;
    if (!isManagedGuild(client.env, newMember.guild.id)) return;

    if (oldMember.premiumSince !== newMember.premiumSince) {
      scheduleMemberCounterRefresh(client, newMember.guild.id);
    }

    const justBoosted = !oldMember.premiumSince && Boolean(newMember.premiumSince);
    if (!justBoosted) return;

    const boostChannelId = client.env.BOOST_THANK_YOU_CHANNEL_ID;
    if (!boostChannelId) return;
    const channel = await newMember.guild.channels.fetch(boostChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    await channel
      .send({
        content: `${newMember}`,
        allowedMentions: { users: [newMember.id] },
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "donation",
            title: "Thank you for boosting SILK™ ASE!",
            description:
              `${newMember}, thank you for boosting **${newMember.guild.name}**!\n\n` +
              "Your boost helps support the SILK™ ASE PS4/PS5 community, improves the Discord, and keeps the server looking premium for every survivor.",
            fields: [
              {
                name: "Booster",
                value: `${newMember}`,
                inline: true,
              },
              {
                name: "Server boosts",
                value: String(newMember.guild.premiumSubscriptionCount ?? "Updated"),
                inline: true,
              },
            ],
          }),
        ],
      })
      .catch((err) => {
        client.log.warn({ err, guildId: newMember.guild.id, userId: newMember.id }, "Failed to send boost thank-you embed");
      });
  },
} satisfies BotEvent;
