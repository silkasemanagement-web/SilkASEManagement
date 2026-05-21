import type { ChatInputCommandInteraction, TextChannel } from "discord.js";

export function interactionTextChannel(interaction: ChatInputCommandInteraction): TextChannel | null {
  const ch = interaction.channel;
  if (!interaction.guild || !ch?.isTextBased()) return null;
  return ch as TextChannel;
}
