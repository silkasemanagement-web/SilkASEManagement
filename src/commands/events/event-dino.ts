import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { MiniGameHostService } from "../../services/MiniGameHostService.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const eventDinoCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-dino")
    .setDescription("Start an ASE PS4/PS5 scrambled dino guessing event.")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(true)),
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
          DynamicEmbedBuilder.build({ theme: "alert", title: "Event", description: "Invalid channel." }),
        ],
      });
      return;
    }
    const mini = new MiniGameHostService(client.cache);
    await mini.hostDinoScramble(channel, 10);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Dino event live",
          description: `Answer stored server-side for <#${channel.id}>.`,
        }),
      ],
    });
  },
};
