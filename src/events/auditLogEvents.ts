import { type APIEmbedField, type ClientEvents, type GuildMember, type Message, type PartialGuildMember, type PartialMessage, type VoiceState } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import { AuditLogService, MAX_AUDIT_LOG_CHANNEL_ID } from "../services/AuditLogService.js";

function clientFrom(source: { client: unknown }) {
  return source.client as ArkBotClient;
}

function userTag(user?: { tag?: string | null; id?: string } | null) {
  if (!user) return "Unknown";
  return user.tag ? `${user.tag} (${user.id})` : user.id ?? "Unknown";
}

function channelLabel(channel?: { id?: string; name?: string | null } | null) {
  if (!channel) return "Unknown";
  return channel.name ? `#${channel.name} (${channel.id})` : channel.id ?? "Unknown";
}

function messageFields(message: Message | PartialMessage): APIEmbedField[] {
  return [
    { name: "Message ID", value: message.id, inline: true },
    { name: "Channel", value: channelLabel(message.channel), inline: true },
    { name: "Author", value: userTag(message.author), inline: true },
    { name: "Content", value: message.content || "[no content available]" },
    { name: "Attachments", value: message.attachments?.size ? [...message.attachments.values()].map((a) => a.url).join("\n") : "None" },
  ];
}

function memberRoleDiff(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
  const oldRoles = new Set(oldMember.roles.cache.keys());
  const newRoles = new Set(newMember.roles.cache.keys());
  const added = [...newRoles].filter((roleId) => !oldRoles.has(roleId));
  const removed = [...oldRoles].filter((roleId) => !newRoles.has(roleId));
  return {
    added: added.length ? added.map((id) => `<@&${id}>`).join(", ") : "None",
    removed: removed.length ? removed.map((id) => `<@&${id}>`).join(", ") : "None",
  };
}

function voiceChanges(oldState: VoiceState, newState: VoiceState) {
  const changes: APIEmbedField[] = [];
  if (oldState.channelId !== newState.channelId) {
    changes.push({ name: "Channel", value: `${oldState.channel?.name ?? "None"} -> ${newState.channel?.name ?? "None"}` });
  }
  if (oldState.serverMute !== newState.serverMute) changes.push({ name: "Server mute", value: `${oldState.serverMute} -> ${newState.serverMute}`, inline: true });
  if (oldState.serverDeaf !== newState.serverDeaf) changes.push({ name: "Server deaf", value: `${oldState.serverDeaf} -> ${newState.serverDeaf}`, inline: true });
  if (oldState.selfMute !== newState.selfMute) changes.push({ name: "Self mute", value: `${oldState.selfMute} -> ${newState.selfMute}`, inline: true });
  if (oldState.selfDeaf !== newState.selfDeaf) changes.push({ name: "Self deaf", value: `${oldState.selfDeaf} -> ${newState.selfDeaf}`, inline: true });
  if (oldState.streaming !== newState.streaming) changes.push({ name: "Streaming", value: `${oldState.streaming} -> ${newState.streaming}`, inline: true });
  if (oldState.selfVideo !== newState.selfVideo) changes.push({ name: "Video", value: `${oldState.selfVideo} -> ${newState.selfVideo}`, inline: true });
  return changes;
}

export const auditMessageCreateEvent = {
  name: "messageCreate" as const,
  async execute(...[message]: ClientEvents["messageCreate"]) {
    if (!message.guild) return;
    await AuditLogService.log(clientFrom(message), {
      guild: message.guild,
      title: "Message created",
      description: `A message was sent in ${channelLabel(message.channel)}.`,
      fields: messageFields(message),
      sourceChannelId: message.channel.id,
      sourceUserId: message.author.id,
      eventId: `messageCreate:${message.id}`,
      occurredAt: message.createdTimestamp,
    });
  },
} satisfies BotEvent;

export const auditMessageDeleteEvent = {
  name: "messageDelete" as const,
  async execute(...[message]: ClientEvents["messageDelete"]) {
    if (!message.guild) return;
    await AuditLogService.log(clientFrom(message), {
      guild: message.guild,
      title: "Message deleted",
      description: `A message was deleted from ${channelLabel(message.channel)}.`,
      fields: messageFields(message),
      sourceChannelId: message.channel.id,
      sourceUserId: message.author?.id,
      eventId: `messageDelete:${message.id}`,
      occurredAt: message.createdTimestamp,
    });
  },
} satisfies BotEvent;

export const auditMessageBulkDeleteEvent = {
  name: "messageDeleteBulk" as const,
  async execute(...[messages, channel]: ClientEvents["messageDeleteBulk"]) {
    if (!channel.guild) return;
    const preview = [...messages.values()].slice(0, 10).map((message) => `${message.id}: ${message.content || "[no content]"}`);
    await AuditLogService.log(channel.client as ArkBotClient, {
      guild: channel.guild,
      title: "Messages bulk deleted",
      description: `${messages.size} messages were bulk deleted from ${channelLabel(channel)}.`,
      fields: [{ name: "Preview", value: preview.length ? preview.join("\n") : "No cached message content." }],
      sourceChannelId: channel.id,
      eventId: `messageDeleteBulk:${channel.id}:${[...messages.keys()].sort().join(",")}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditMessageUpdateEvent = {
  name: "messageUpdate" as const,
  async execute(...[oldMessage, newMessage]: ClientEvents["messageUpdate"]) {
    if (!newMessage.guild) return;
    await AuditLogService.log(clientFrom(newMessage), {
      guild: newMessage.guild,
      title: "Message edited",
      description: `A message was edited in ${channelLabel(newMessage.channel)}.`,
      fields: [
        { name: "Message ID", value: newMessage.id, inline: true },
        { name: "Author", value: userTag(newMessage.author), inline: true },
        { name: "Before", value: oldMessage.content || "[no old content available]" },
        { name: "After", value: newMessage.content || "[no new content available]" },
      ],
      sourceChannelId: newMessage.channel.id,
      sourceUserId: newMessage.author?.id,
      eventId: `messageUpdate:${newMessage.id}:${newMessage.editedTimestamp ?? Date.now()}`,
      occurredAt: newMessage.editedTimestamp ?? Date.now(),
    });
  },
} satisfies BotEvent;

export const auditReactionAddEvent = {
  name: "messageReactionAdd" as const,
  async execute(...[reaction, user]: ClientEvents["messageReactionAdd"]) {
    const message = reaction.message;
    if (!message.guild) return;
    await AuditLogService.log(clientFrom(reaction), {
      guild: message.guild,
      title: "Reaction added",
      description: `${userTag(user)} added ${reaction.emoji.toString()} in ${channelLabel(message.channel)}.`,
      fields: [{ name: "Message ID", value: message.id, inline: true }],
      sourceChannelId: message.channel.id,
      sourceUserId: user.id,
      eventId: `reactionAdd:${message.id}:${reaction.emoji.identifier}:${user.id}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditReactionRemoveEvent = {
  name: "messageReactionRemove" as const,
  async execute(...[reaction, user]: ClientEvents["messageReactionRemove"]) {
    const message = reaction.message;
    if (!message.guild) return;
    await AuditLogService.log(clientFrom(reaction), {
      guild: message.guild,
      title: "Reaction removed",
      description: `${userTag(user)} removed ${reaction.emoji.toString()} in ${channelLabel(message.channel)}.`,
      fields: [{ name: "Message ID", value: message.id, inline: true }],
      sourceChannelId: message.channel.id,
      sourceUserId: user.id,
      eventId: `reactionRemove:${message.id}:${reaction.emoji.identifier}:${user.id}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditReactionRemoveAllEvent = {
  name: "messageReactionRemoveAll" as const,
  async execute(...[message, reactions]: ClientEvents["messageReactionRemoveAll"]) {
    if (!message.guild) return;
    await AuditLogService.log(clientFrom(message), {
      guild: message.guild,
      title: "All reactions removed",
      description: `All reactions were removed from a message in ${channelLabel(message.channel)}.`,
      fields: [
        { name: "Message ID", value: message.id, inline: true },
        { name: "Reaction count", value: String(reactions.size), inline: true },
      ],
      sourceChannelId: message.channel.id,
      eventId: `reactionRemoveAll:${message.id}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditMemberUpdateEvent = {
  name: "guildMemberUpdate" as const,
  async execute(...[oldMember, newMember]: ClientEvents["guildMemberUpdate"]) {
    const roleDiff = memberRoleDiff(oldMember, newMember);
    await AuditLogService.log(clientFrom(newMember), {
      guild: newMember.guild,
      title: "Member updated",
      description: `${userTag(newMember.user)} was updated.`,
      fields: [
        { name: "Nickname", value: `${oldMember.nickname ?? "None"} -> ${newMember.nickname ?? "None"}` },
        { name: "Roles added", value: roleDiff.added },
        { name: "Roles removed", value: roleDiff.removed },
        { name: "Timeout", value: `${oldMember.communicationDisabledUntil?.toISOString() ?? "None"} -> ${newMember.communicationDisabledUntil?.toISOString() ?? "None"}` },
        { name: "Boosting since", value: `${oldMember.premiumSince?.toISOString() ?? "None"} -> ${newMember.premiumSince?.toISOString() ?? "None"}` },
      ],
      sourceUserId: newMember.id,
      eventId: `memberUpdate:${newMember.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditVoiceStateUpdateEvent = {
  name: "voiceStateUpdate" as const,
  async execute(...[oldState, newState]: ClientEvents["voiceStateUpdate"]) {
    const fields = voiceChanges(oldState, newState);
    if (!fields.length) return;
    await AuditLogService.log((newState.client ?? oldState.client) as ArkBotClient, {
      guild: newState.guild ?? oldState.guild,
      title: "Voice state updated",
      description: `${userTag(newState.member?.user ?? oldState.member?.user)} voice state changed.`,
      fields,
      sourceUserId: newState.id,
      eventId: `voiceStateUpdate:${newState.id}:${oldState.channelId ?? "none"}:${newState.channelId ?? "none"}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

/** Fire-and-forget from the main interactionCreate handler (avoids a second listener racing ticket ack). */
export async function auditInteractionCreate(...[interaction]: ClientEvents["interactionCreate"]) {
  if (!interaction.guild) return;
  const title = interaction.isChatInputCommand() ? `Slash command: /${interaction.commandName}` : `Interaction: ${interaction.type}`;
  await AuditLogService.log(interaction.client as ArkBotClient, {
    guild: interaction.guild,
    title,
    description: `${userTag(interaction.user)} used an interaction.`,
    fields: [
      { name: "Channel", value: channelLabel(interaction.channel), inline: true },
      { name: "Interaction ID", value: interaction.id, inline: true },
    ],
    sourceChannelId: interaction.channelId,
    sourceUserId: interaction.user.id,
    eventId: `interactionCreate:${interaction.id}`,
    occurredAt: interaction.createdTimestamp,
  });
}

export const auditChannelCreateEvent = {
  name: "channelCreate" as const,
  async execute(...[channel]: ClientEvents["channelCreate"]) {
    await AuditLogService.log(channel.client as ArkBotClient, {
      guild: channel.guild,
      title: "Channel created",
      description: `${channelLabel(channel)} was created.`,
      fields: [{ name: "Type", value: String(channel.type), inline: true }],
      sourceChannelId: channel.id,
      eventId: `channelCreate:${channel.id}`,
      occurredAt: channel.createdTimestamp,
    });
  },
} satisfies BotEvent;

export const auditChannelDeleteEvent = {
  name: "channelDelete" as const,
  async execute(...[channel]: ClientEvents["channelDelete"]) {
    if (!("guild" in channel)) return;
    await AuditLogService.log(channel.client as ArkBotClient, {
      guild: channel.guild,
      title: "Channel deleted",
      description: `${channelLabel(channel)} was deleted.`,
      fields: [{ name: "Type", value: String(channel.type), inline: true }],
      sourceChannelId: channel.id,
      eventId: `channelDelete:${channel.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditChannelUpdateEvent = {
  name: "channelUpdate" as const,
  async execute(...[oldChannel, newChannel]: ClientEvents["channelUpdate"]) {
    if (!("guild" in newChannel) || !("name" in oldChannel) || !("name" in newChannel)) return;
    await AuditLogService.log(newChannel.client as ArkBotClient, {
      guild: newChannel.guild,
      title: "Channel updated",
      description: `${channelLabel(newChannel)} was updated.`,
      fields: [
        { name: "Name", value: `${oldChannel.name} -> ${newChannel.name}` },
        { name: "Type", value: String(newChannel.type), inline: true },
      ],
      sourceChannelId: newChannel.id,
      eventId: `channelUpdate:${newChannel.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditRoleCreateEvent = {
  name: "roleCreate" as const,
  async execute(...[role]: ClientEvents["roleCreate"]) {
    await AuditLogService.log(role.client as ArkBotClient, {
      guild: role.guild,
      title: "Role created",
      description: `${role.name} (${role.id}) was created.`,
      fields: [{ name: "Permissions", value: role.permissions.bitfield.toString() }],
      eventId: `roleCreate:${role.id}`,
      occurredAt: role.createdTimestamp,
    });
  },
} satisfies BotEvent;

export const auditRoleDeleteEvent = {
  name: "roleDelete" as const,
  async execute(...[role]: ClientEvents["roleDelete"]) {
    await AuditLogService.log(role.client as ArkBotClient, {
      guild: role.guild,
      title: "Role deleted",
      description: `${role.name} (${role.id}) was deleted.`,
      fields: [{ name: "Permissions", value: role.permissions.bitfield.toString() }],
      eventId: `roleDelete:${role.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditRoleUpdateEvent = {
  name: "roleUpdate" as const,
  async execute(...[oldRole, newRole]: ClientEvents["roleUpdate"]) {
    await AuditLogService.log(newRole.client as ArkBotClient, {
      guild: newRole.guild,
      title: "Role updated",
      description: `${newRole.name} (${newRole.id}) was updated.`,
      fields: [
        { name: "Name", value: `${oldRole.name} -> ${newRole.name}` },
        { name: "Color", value: `${oldRole.hexColor} -> ${newRole.hexColor}`, inline: true },
        { name: "Permissions", value: `${oldRole.permissions.bitfield.toString()} -> ${newRole.permissions.bitfield.toString()}` },
      ],
      eventId: `roleUpdate:${newRole.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditEmojiCreateEvent = {
  name: "emojiCreate" as const,
  async execute(...[emoji]: ClientEvents["emojiCreate"]) {
    await AuditLogService.log(emoji.client as ArkBotClient, {
      guild: emoji.guild,
      title: "Emoji created",
      description: `${emoji.name ?? "Unknown"} (${emoji.id}) was created.`,
      fields: [{ name: "Animated", value: String(emoji.animated), inline: true }],
      eventId: `emojiCreate:${emoji.id}`,
      occurredAt: emoji.createdTimestamp,
    });
  },
} satisfies BotEvent;

export const auditEmojiDeleteEvent = {
  name: "emojiDelete" as const,
  async execute(...[emoji]: ClientEvents["emojiDelete"]) {
    await AuditLogService.log(emoji.client as ArkBotClient, {
      guild: emoji.guild,
      title: "Emoji deleted",
      description: `${emoji.name ?? "Unknown"} (${emoji.id}) was deleted.`,
      eventId: `emojiDelete:${emoji.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditEmojiUpdateEvent = {
  name: "emojiUpdate" as const,
  async execute(...[oldEmoji, newEmoji]: ClientEvents["emojiUpdate"]) {
    await AuditLogService.log(newEmoji.client as ArkBotClient, {
      guild: newEmoji.guild,
      title: "Emoji updated",
      description: `${newEmoji.name ?? "Unknown"} (${newEmoji.id}) was updated.`,
      fields: [{ name: "Name", value: `${oldEmoji.name ?? "Unknown"} -> ${newEmoji.name ?? "Unknown"}` }],
      eventId: `emojiUpdate:${newEmoji.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditStickerEvents = [
  {
    name: "stickerCreate" as const,
    async execute(...[sticker]: ClientEvents["stickerCreate"]) {
      if (!sticker.guild) return;
      await AuditLogService.log(sticker.client as ArkBotClient, {
        guild: sticker.guild,
        title: "Sticker created",
        description: `${sticker.name} (${sticker.id}) was created.`,
        eventId: `stickerCreate:${sticker.id}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "stickerDelete" as const,
    async execute(...[sticker]: ClientEvents["stickerDelete"]) {
      if (!sticker.guild) return;
      await AuditLogService.log(sticker.client as ArkBotClient, {
        guild: sticker.guild,
        title: "Sticker deleted",
        description: `${sticker.name} (${sticker.id}) was deleted.`,
        eventId: `stickerDelete:${sticker.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "stickerUpdate" as const,
    async execute(...[oldSticker, newSticker]: ClientEvents["stickerUpdate"]) {
      if (!newSticker.guild) return;
      await AuditLogService.log(newSticker.client as ArkBotClient, {
        guild: newSticker.guild,
        title: "Sticker updated",
        description: `${newSticker.name} (${newSticker.id}) was updated.`,
        fields: [{ name: "Name", value: `${oldSticker.name} -> ${newSticker.name}` }],
        eventId: `stickerUpdate:${newSticker.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
] satisfies BotEvent[];

export const auditInviteEvents = [
  {
    name: "inviteCreate" as const,
    async execute(...[invite]: ClientEvents["inviteCreate"]) {
      if (!invite.guild) return;
      await AuditLogService.log(invite.client as ArkBotClient, {
        guildId: invite.guild?.id,
        title: "Invite created",
        description: `Invite ${invite.code} was created.`,
        fields: [
          { name: "Channel", value: channelLabel(invite.channel), inline: true },
          { name: "Inviter", value: userTag(invite.inviter), inline: true },
          { name: "Max uses", value: String(invite.maxUses ?? "Unlimited"), inline: true },
        ],
        eventId: `inviteCreate:${invite.code}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "inviteDelete" as const,
    async execute(...[invite]: ClientEvents["inviteDelete"]) {
      if (!invite.guild) return;
      await AuditLogService.log(invite.client as ArkBotClient, {
        guildId: invite.guild?.id,
        title: "Invite deleted",
        description: `Invite ${invite.code} was deleted.`,
        fields: [{ name: "Channel", value: channelLabel(invite.channel), inline: true }],
        eventId: `inviteDelete:${invite.code}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
] satisfies BotEvent[];

export const auditGuildUpdateEvent = {
  name: "guildUpdate" as const,
  async execute(...[oldGuild, newGuild]: ClientEvents["guildUpdate"]) {
    await AuditLogService.log(newGuild.client as ArkBotClient, {
      guild: newGuild,
      title: "Server updated",
      description: `${newGuild.name} was updated.`,
      fields: [
        { name: "Name", value: `${oldGuild.name} -> ${newGuild.name}` },
        { name: "Boost count", value: `${oldGuild.premiumSubscriptionCount ?? 0} -> ${newGuild.premiumSubscriptionCount ?? 0}`, inline: true },
        { name: "Boost tier", value: `${oldGuild.premiumTier} -> ${newGuild.premiumTier}`, inline: true },
      ],
      eventId: `guildUpdate:${newGuild.id}:${Date.now()}`,
      occurredAt: Date.now(),
    });
  },
} satisfies BotEvent;

export const auditGuildScheduledEventEvents = [
  {
    name: "guildScheduledEventCreate" as const,
    async execute(...[event]: ClientEvents["guildScheduledEventCreate"]) {
      await AuditLogService.log(event.client as ArkBotClient, {
        guild: event.guild,
        title: "Scheduled event created",
        description: `${event.name} (${event.id}) was created.`,
        eventId: `scheduledEventCreate:${event.id}`,
        occurredAt: event.createdTimestamp,
      });
    },
  },
  {
    name: "guildScheduledEventDelete" as const,
    async execute(...[event]: ClientEvents["guildScheduledEventDelete"]) {
      await AuditLogService.log(event.client as ArkBotClient, {
        guild: event.guild,
        title: "Scheduled event deleted",
        description: `${event.name} (${event.id}) was deleted.`,
        eventId: `scheduledEventDelete:${event.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "guildScheduledEventUpdate" as const,
    async execute(...[oldEvent, newEvent]: ClientEvents["guildScheduledEventUpdate"]) {
      await AuditLogService.log(newEvent.client as ArkBotClient, {
        guild: newEvent.guild,
        title: "Scheduled event updated",
        description: `${newEvent.name} (${newEvent.id}) was updated.`,
        fields: [{ name: "Name", value: `${oldEvent?.name ?? "Unknown"} -> ${newEvent.name}` }],
        eventId: `scheduledEventUpdate:${newEvent.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "guildScheduledEventUserAdd" as const,
    async execute(...[event, user]: ClientEvents["guildScheduledEventUserAdd"]) {
      await AuditLogService.log(event.client as ArkBotClient, {
        guild: event.guild,
        title: "Scheduled event user added",
        description: `${userTag(user)} subscribed to ${event.name}.`,
        sourceUserId: user.id,
        eventId: `scheduledEventUserAdd:${event.id}:${user.id}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "guildScheduledEventUserRemove" as const,
    async execute(...[event, user]: ClientEvents["guildScheduledEventUserRemove"]) {
      await AuditLogService.log(event.client as ArkBotClient, {
        guild: event.guild,
        title: "Scheduled event user removed",
        description: `${userTag(user)} unsubscribed from ${event.name}.`,
        sourceUserId: user.id,
        eventId: `scheduledEventUserRemove:${event.id}:${user.id}`,
        occurredAt: Date.now(),
      });
    },
  },
] satisfies BotEvent[];

export const auditThreadEvents = [
  {
    name: "threadCreate" as const,
    async execute(...[thread]: ClientEvents["threadCreate"]) {
      await AuditLogService.log(thread.client as ArkBotClient, {
        guild: thread.guild,
        title: "Thread created",
        description: `${channelLabel(thread)} was created.`,
        sourceChannelId: thread.id,
        eventId: `threadCreate:${thread.id}`,
        occurredAt: thread.createdTimestamp,
      });
    },
  },
  {
    name: "threadDelete" as const,
    async execute(...[thread]: ClientEvents["threadDelete"]) {
      await AuditLogService.log(thread.client as ArkBotClient, {
        guild: thread.guild,
        title: "Thread deleted",
        description: `${channelLabel(thread)} was deleted.`,
        sourceChannelId: thread.id,
        eventId: `threadDelete:${thread.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "threadUpdate" as const,
    async execute(...[oldThread, newThread]: ClientEvents["threadUpdate"]) {
      await AuditLogService.log(newThread.client as ArkBotClient, {
        guild: newThread.guild,
        title: "Thread updated",
        description: `${channelLabel(newThread)} was updated.`,
        fields: [{ name: "Name", value: `${oldThread.name} -> ${newThread.name}` }],
        sourceChannelId: newThread.id,
        eventId: `threadUpdate:${newThread.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
] satisfies BotEvent[];

export const auditMemberAddRemoveEvents = [
  {
    name: "guildMemberRemove" as const,
    async execute(...[member]: ClientEvents["guildMemberRemove"]) {
      await AuditLogService.log(member.client as ArkBotClient, {
        guild: member.guild,
        title: "Member left",
        description: `${userTag(member.user)} left the server.`,
        sourceUserId: member.id,
        eventId: `memberRemove:${member.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "guildBanAdd" as const,
    async execute(...[ban]: ClientEvents["guildBanAdd"]) {
      await AuditLogService.log(ban.client as ArkBotClient, {
        guild: ban.guild,
        title: "Member banned",
        description: `${userTag(ban.user)} was banned.`,
        fields: [{ name: "Reason", value: ban.reason ?? "No reason available" }],
        sourceUserId: ban.user.id,
        eventId: `banAdd:${ban.user.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
  {
    name: "guildBanRemove" as const,
    async execute(...[ban]: ClientEvents["guildBanRemove"]) {
      await AuditLogService.log(ban.client as ArkBotClient, {
        guild: ban.guild,
        title: "Member unbanned",
        description: `${userTag(ban.user)} was unbanned.`,
        sourceUserId: ban.user.id,
        eventId: `banRemove:${ban.user.id}:${Date.now()}`,
        occurredAt: Date.now(),
      });
    },
  },
] satisfies BotEvent[];

export const auditLogEvents: BotEvent[] = [
  auditMessageCreateEvent,
  auditMessageDeleteEvent,
  auditMessageBulkDeleteEvent,
  auditMessageUpdateEvent,
  auditReactionAddEvent,
  auditReactionRemoveEvent,
  auditReactionRemoveAllEvent,
  auditMemberUpdateEvent,
  auditVoiceStateUpdateEvent,
  auditChannelCreateEvent,
  auditChannelDeleteEvent,
  auditChannelUpdateEvent,
  auditRoleCreateEvent,
  auditRoleDeleteEvent,
  auditRoleUpdateEvent,
  auditEmojiCreateEvent,
  auditEmojiDeleteEvent,
  auditEmojiUpdateEvent,
  auditGuildUpdateEvent,
  ...auditStickerEvents,
  ...auditInviteEvents,
  ...auditGuildScheduledEventEvents,
  ...auditThreadEvents,
  ...auditMemberAddRemoveEvents,
];

export { MAX_AUDIT_LOG_CHANNEL_ID };
