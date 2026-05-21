import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { buildStudioComponents } from "../../handlers/interactions/embedInteractions.js";

export const embedCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("embed-create")
    .setDescription("Professional embed studio with modals, preview, and channel targeting.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  meta: { cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Embed Studio",
          description:
            "1) Configure **core** and **media** via modals.\n2) Choose a **channel**.\n3) **Preview**, then **Publish**.\n\nButtons support up to **two link buttons** from the media modal.",
        }),
      ],
      components: buildStudioComponents(),
    });
  },
};
