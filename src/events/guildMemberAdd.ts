import type { BotEvent } from "../interfaces/IEvent.js";
import type { GuildMember } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";
import { UserProfileModel } from "../models/UserProfile.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { scheduleMemberCounterRefresh } from "../services/MemberCountService.js";
import { buildDefaultWelcomeMessage, interpolateWelcomeMessage } from "../utils/welcomeMessage.js";


export const guildMemberAddEvent = {
  name: "guildMemberAdd" as const,
  async execute(member: GuildMember) {
    const client = member.client as ArkBotClient;
    if (!isManagedGuild(client.env, member.guild.id)) return;
    scheduleMemberCounterRefresh(client, member.guild.id);
    await UserProfileModel.updateOne(
      { guildId: member.guild.id, userId: member.id },
      { $set: { joinedAt: new Date(), usernameSnapshot: member.user.username } },
      { upsert: true },
    );
    const cfg = await client.config.getGuild(member.guild.id);
    const welcome = (cfg.welcome ?? {}) as NonNullable<GuildConfigurationDocument["welcome"]>;
    if (welcome.enabled !== false) {
      const channelId = welcome.joinChannelId ?? client.env.LEGACY_WELCOME_CHANNEL_ID;
      if (channelId) {
        const title = welcome.joinEmbed?.title ?? "Welcome To SILK™ | 300+ POP";
        const template = welcome.joinEmbed?.description ?? buildDefaultWelcomeMessage(member);
        await member.guild.channels.fetch().catch(() => null);
        const welcomeChannel = await member.guild.channels.fetch(channelId).catch(() => null);
        if (welcomeChannel?.isTextBased() && "send" in welcomeChannel) {
          await welcomeChannel.send({
            content: `${member}`,
            allowedMentions: { users: [member.id] },
            embeds: [
              DynamicEmbedBuilder.build({
                theme: "ark",
                title,
                description: interpolateWelcomeMessage(template, member),
              }),
            ],
          });
        }
      }
      const legacyRole = client.env.LEGACY_AUTO_ROLE_ID;
      const autoRoleIds = welcome.autoRoleIds?.length ? welcome.autoRoleIds : legacyRole ? [legacyRole] : [];
      for (const roleId of autoRoleIds) {
        const autoRole = await member.guild.roles.fetch(roleId).catch(() => null);
        if (autoRole) await member.roles.add(autoRole, "welcome auto-role").catch(() => null);
      }
    }
  },
} satisfies BotEvent;
