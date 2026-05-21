import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { AfkStatusModel } from "../../models/AfkStatus.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const afkCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set yourself as AFK until you send another message.")
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("What are you going AFK for?")
        .setRequired(true)
        .setMaxLength(512),
    ),
  meta: { cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const reason = interaction.options.getString("reason", true).trim();
    await AfkStatusModel.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: interaction.user.id },
      {
        $set: {
          reason,
          usernameSnapshot: interaction.user.tag,
          lastMentionNoticeAt: undefined,
        },
      },
      { upsert: true, new: true },
    );

    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "AFK set",
          description: `${interaction.user}, I marked you as AFK.\n\nReason: **${reason}**\n\nYour AFK will clear automatically when you send a normal message.`,
        }),
      ],
      allowedMentions: { users: [interaction.user.id] },
    });
  },
};
