import type { ButtonInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { SuggestionModel } from "../../models/Suggestion.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export async function handleSuggestVote(_client: ArkBotClient, interaction: ButtonInteraction) {
  const doc = await SuggestionModel.findOne({ messageId: interaction.message.id });
  if (!doc) {
    await interaction.reply({ ephemeral: true, content: "Suggestion record not found." });
    return;
  }
  const inc = interaction.customId.endsWith("upvote") ? { upvotes: 1 } : { downvotes: 1 };
  await SuggestionModel.updateOne({ _id: doc._id }, { $inc: inc });
  const updated = await SuggestionModel.findById(doc._id).lean();
  if (!updated) return;
  await interaction.update({
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "neutral",
        title: "Community suggestion",
        description: updated.content,
        author: updated.anonymous
          ? { name: "Anonymous" }
          : { name: "Member", iconURL: interaction.user.displayAvatarURL() },
        fields: [
          { name: "Upvotes", value: String(updated.upvotes ?? 0), inline: true },
          { name: "Downvotes", value: String(updated.downvotes ?? 0), inline: true },
          { name: "Status", value: updated.status, inline: true },
        ],
      }),
    ],
    components: interaction.message.components,
  });
}
