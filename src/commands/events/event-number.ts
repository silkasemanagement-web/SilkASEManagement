import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { MiniGameHostService } from "../../services/MiniGameHostService.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const eventNumberCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-number")
    .setDescription("Start a 10-minute higher/lower guessing event (1-10,000).")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel to host").setRequired(true)),
  meta: { requireStaff: true, cooldownMs: 60_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const client = interaction.client as ArkBotClient;
    const raw = interaction.options.getChannel("channel", true);
    const channel = await interaction.guild.channels.fetch(raw.id);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Guess the number",
            description: "Pick a text channel.",
          }),
        ],
      });
      return;
    }
    const mini = new MiniGameHostService(client.cache);
    await mini.hostNumberGuess(channel, 10);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Event armed",
          description: `Secret stored in Redis for <#${channel.id}>.`,
        }),
      ],
    });
  },
};
