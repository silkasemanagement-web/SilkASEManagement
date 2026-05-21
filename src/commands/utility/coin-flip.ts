import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const coinFlipCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("coin-flip").setDescription("Flip a coin."),
  meta: { cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Coin flip",
          description: `The coin landed on **${result}**.`,
        }),
      ],
    });
  },
};
