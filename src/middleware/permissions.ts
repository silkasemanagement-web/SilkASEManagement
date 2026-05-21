import { PermissionFlagsBits, type ChatInputCommandInteraction, GuildMember } from "discord.js";
import type { CommandMeta } from "../interfaces/ICommand.js";
import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";
import { isAdmin, isStaff } from "../utils/discord.js";

export async function assertCommandPermissions(params: {
  interaction: ChatInputCommandInteraction;
  meta?: CommandMeta;
  cfg: GuildConfigurationDocument;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { interaction, meta, cfg } = params;
  if (!interaction.guild || !interaction.member) {
    return { ok: false, message: "This command must be used inside a server." };
  }

  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return { ok: false, message: "Unable to resolve your member profile." };

  if (meta?.requireAdmin && !isAdmin(member, cfg)) {
    return { ok: false, message: "You need an administrator role to use this command." };
  }
  if (meta?.requireStaff && !isStaff(member, cfg)) {
    return { ok: false, message: "You need a staff role to use this command." };
  }
  if (meta?.requiredDiscordPermissions?.length) {
    const missing = meta.requiredDiscordPermissions.filter((bit) => !member.permissions.has(bit));
    if (missing.length && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { ok: false, message: "You are missing required Discord permissions for this command." };
    }
  }
  return { ok: true };
}
