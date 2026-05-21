import type { ButtonInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { GiveawayModel } from "../../models/Giveaway.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

async function safeButtonReply(interaction: ButtonInteraction, content: string) {
  const payload = {
    ephemeral: true,
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "ark",
        title: "Giveaway",
        description: content,
      }),
    ],
  };
  if (interaction.deferred) return interaction.editReply(payload).catch(() => null);
  if (interaction.replied) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

export async function handleGiveawayEnter(_client: ArkBotClient, interaction: ButtonInteraction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
  const messageId = interaction.customId.split(":").pop();
  if (!messageId) return;
  const doc = await GiveawayModel.findOne({ messageId });
  if (!doc || doc.status !== "active") {
    await safeButtonReply(interaction, "Giveaway not active.");
    return;
  }
  if (doc.endsAt.getTime() < Date.now()) {
    await safeButtonReply(interaction, "Giveaway ended.");
    return;
  }
  if (doc.entrants.includes(interaction.user.id)) {
    await safeButtonReply(interaction, "You are already entered.");
    return;
  }
  await GiveawayModel.updateOne({ _id: doc._id }, { $push: { entrants: interaction.user.id } });
  await safeButtonReply(interaction, "Entry recorded. Good luck!");
}
