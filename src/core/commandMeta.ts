import { PermissionFlagsBits } from "discord.js";
import type { CommandMeta } from "../interfaces/ICommand.js";

export const adminMeta: CommandMeta = {
  requiredDiscordPermissions: [PermissionFlagsBits.Administrator],
  cooldownMs: 5000,
  deferReply: true,
  deferEphemeral: true,
};

export const manageGuildMeta: CommandMeta = {
  requiredDiscordPermissions: [PermissionFlagsBits.ManageGuild],
  cooldownMs: 5000,
  deferReply: true,
  deferEphemeral: true,
};

export const manageChannelMeta: CommandMeta = {
  requiredDiscordPermissions: [PermissionFlagsBits.ManageChannels],
  cooldownMs: 5000,
  deferReply: true,
  deferEphemeral: true,
};

export const modMeta: CommandMeta = {
  requiredDiscordPermissions: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers],
  cooldownMs: 5000,
  deferReply: true,
  deferEphemeral: true,
};

export const publicMeta: CommandMeta = {
  cooldownMs: 3000,
  deferReply: true,
  deferEphemeral: true,
};
