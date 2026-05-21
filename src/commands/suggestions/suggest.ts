import { SlashCommandBuilder } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { SuggestionModel } from "../../models/Suggestion.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { isCommandOnlyChannel } from "../../utils/commandOnlyChannel.js";

const LEGACY_SUGGESTION_COMMAND_CHANNEL_ID = "1505800115515031573";
const LEGACY_SUGGESTION_REVIEW_CHANNEL_ID = "1505800154459013232";

async function respondSuggestion(interaction: Parameters<SlashCommand["execute"]>[0], messageUrl: string) {
  const payload = {
    ephemeral: true,
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "ark",
        title: "Thank you for your suggestion",
        description: `Your suggestion has been posted for the community to vote on.\n[Jump to suggestion](${messageUrl})`,
      }),
    ],
  };

  if (!interaction.isRepliable()) return;
  if (interaction.deferred) {
    await interaction.editReply(payload).catch(() => null);
    return;
  }
  if (interaction.replied) {
    await interaction.followUp(payload).catch(() => null);
    return;
  }

  await interaction.reply(payload).catch(async () => {
    if (interaction.channel?.isTextBased() && "send" in interaction.channel) {
      await interaction.channel
        .send({
          embeds: [
            DynamicEmbedBuilder.build({
              theme: "ark",
              title: "Thank you for your suggestion",
              description: `${interaction.user}, your suggestion has been posted.\n[Jump to suggestion](${messageUrl})`,
            }),
          ],
          allowedMentions: { users: [interaction.user.id] },
        })
        .catch(() => null);
    }
  });
}

export const suggestCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit a suggestion to the configured review channel.")
    .addStringOption((o) => o.setName("idea").setDescription("Your suggestion").setRequired(true).setMaxLength(2000))
    .addBooleanOption((o) => o.setName("anonymous").setDescription("Hide your name in public post")),
  meta: { cooldownMs: 30_000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const client = interaction.client as ArkBotClient;
    const cfg = await client.config.getGuild(interaction.guild.id);
    const commandChannelId =
      cfg.suggestions?.commandChannelId ??
      client.env.SUGGESTION_COMMAND_CHANNEL_ID ??
      LEGACY_SUGGESTION_COMMAND_CHANNEL_ID;
    const allowed =
      interaction.channelId === commandChannelId || isCommandOnlyChannel(cfg, interaction.channelId);
    if (!allowed) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Suggestions",
            description: `Use <#${commandChannelId}> or another **commands-only** channel for \`/suggest\`.`,
          }),
        ],
      });
      return;
    }
    const reviewChannelId = cfg.suggestions?.channelId ?? LEGACY_SUGGESTION_REVIEW_CHANNEL_ID;
    const ch = await interaction.guild.channels.fetch(reviewChannelId);
    if (!ch?.isTextBased()) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Suggestions",
            description: "Configured review channel is invalid.",
          }),
        ],
      });
      return;
    }
    const idea = interaction.options.getString("idea", true);
    const anonymous = interaction.options.getBoolean("anonymous") ?? false;
    const embed = DynamicEmbedBuilder.build({
      theme: "neutral",
      title: "Community suggestion",
      description: idea,
      author: anonymous
        ? { name: "Anonymous" }
        : { name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() },
      footer: { text: `ID ${interaction.id}` },
    });
    const msg = await ch.send({ embeds: [embed] });
    await msg.react("✅").catch(() => null);
    await msg.react("❌").catch(() => null);
    await msg.react("🤷").catch(() => null);
    await SuggestionModel.create({
      guildId: interaction.guild.id,
      channelId: ch.id,
      messageId: msg.id,
      authorId: anonymous ? undefined : interaction.user.id,
      anonymous,
      content: idea,
      status: "in_review",
    });
    await respondSuggestion(interaction, msg.url);
  },
};
