import type { StringSelectMenuInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";

export async function handlePollVote(_client: ArkBotClient, interaction: StringSelectMenuInteraction) {
  await interaction.reply({ ephemeral: true, content: "This poll type is no longer active. New polls use reactions." });
}
