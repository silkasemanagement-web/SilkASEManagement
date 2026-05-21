import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const bannerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Show a user's Discord profile banner.")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to show the banner for").setRequired(false),
    ),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const selected = interaction.options.getUser("user") ?? interaction.user;
    const user = await interaction.client.users.fetch(selected.id, { force: true });
    const bannerUrl = user.bannerURL({ extension: "png", size: 4096, forceStatic: false });

    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: bannerUrl ? "neutral" : "alert",
          title: `${user.username}'s banner`,
          description: bannerUrl ? `[Open full size](${bannerUrl})` : "This user does not have a public profile banner.",
          imageURL: bannerUrl ?? undefined,
          thumbnailURL: user.displayAvatarURL({ extension: "png", size: 256, forceStatic: false }),
        }),
      ],
    });
  },
};
