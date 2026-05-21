import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const avatarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's Discord profile avatar.")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to show the avatar for").setRequired(false),
    ),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 4096, forceStatic: false });

    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: `${user.username}'s avatar`,
          description: `[Open full size](${avatarUrl})`,
          imageURL: avatarUrl,
          thumbnailURL: user.displayAvatarURL({ extension: "png", size: 256, forceStatic: false }),
        }),
      ],
    });
  },
};
