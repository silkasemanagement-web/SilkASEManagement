import type { APIEmbedField, ChatInputCommandInteraction } from "discord.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";

export function ok(title: string, description: string, fields: APIEmbedField[] = []) {
  return DynamicEmbedBuilder.build({ theme: "ark", title, description, fields });
}

export function neutral(title: string, description: string, fields: APIEmbedField[] = []) {
  return DynamicEmbedBuilder.build({ theme: "neutral", title, description, fields });
}

export function alert(title: string, description: string, fields: APIEmbedField[] = []) {
  return DynamicEmbedBuilder.build({ theme: "alert", title, description, fields });
}

export async function reply(
  interaction: ChatInputCommandInteraction,
  embed: ReturnType<typeof DynamicEmbedBuilder.build>,
) {
  if (interaction.deferred) {
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  await interaction.reply({ ephemeral: true, embeds: [embed] });
}

export function valueList(values: string[]) {
  return values.length ? values.join("\n").slice(0, 4000) : "No records found.";
}

export function boolLabel(value: boolean | undefined) {
  return value ? "**Enabled**" : "**Disabled**";
}
