import { PermissionFlagsBits, type GuildMember, type Message } from "discord.js";
import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";
import { isStaff } from "./discord.js";

export function getCommandOnlyChannelIds(cfg: GuildConfigurationDocument) {
  return cfg.commandOnlyChannelIds ?? [];
}

export function isCommandOnlyChannel(cfg: GuildConfigurationDocument, channelId: string) {
  return getCommandOnlyChannelIds(cfg).includes(channelId);
}

export function canChatInCommandOnlyChannel(member: GuildMember, cfg: GuildConfigurationDocument) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  if (isStaff(member, cfg)) return true;
  return false;
}

export function shouldBlockPlainMessage(message: Message, cfg: GuildConfigurationDocument) {
  if (!message.guild || message.author.bot) return false;
  if (!isCommandOnlyChannel(cfg, message.channel.id)) return false;
  const member = message.member;
  if (!member) return true;
  return !canChatInCommandOnlyChannel(member, cfg);
}
