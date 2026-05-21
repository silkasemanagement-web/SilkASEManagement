import type { GuildMember } from "discord.js";

const WELCOME_CHANNEL_NAMES = {
  announcements: "📣┃announcements",
  patchNotes: "📰┃patch-notes",
  polls: "📊┃polls",
  serverInfo: "📌┃server-info",
  createTicket: "📩┃create-ticket",
  donationStore: "🛒┃donation-store",
} as const;

function normalizeChannelName(name: string) {
  return name.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function channelMention(member: GuildMember, expectedName: string) {
  const expected = normalizeChannelName(expectedName);
  const channel = member.guild.channels.cache.find((ch) => normalizeChannelName(ch.name) === expected);
  return channel ? `<#${channel.id}>` : `#${expectedName}`;
}

export function buildDefaultWelcomeMessage(member: GuildMember) {
  return `Remember Read Important Channels
${channelMention(member, WELCOME_CHANNEL_NAMES.announcements)}
${channelMention(member, WELCOME_CHANNEL_NAMES.patchNotes)}
${channelMention(member, WELCOME_CHANNEL_NAMES.polls)}

Server Info
${channelMention(member, WELCOME_CHANNEL_NAMES.serverInfo)}

If You Have A Problem
${channelMention(member, WELCOME_CHANNEL_NAMES.createTicket)}

Donations Here
${channelMention(member, WELCOME_CHANNEL_NAMES.donationStore)}`;
}

export function interpolateWelcomeMessage(template: string, member: GuildMember) {
  return template
    .replaceAll("{user}", `${member}`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", String(member.guild.memberCount));
}
