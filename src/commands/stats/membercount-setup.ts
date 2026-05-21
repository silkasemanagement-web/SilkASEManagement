import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const membercountSetupCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("membercount-setup")
    .setDescription("Create locked voice channels for live member counters.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  meta: { cooldownMs: 10_000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("ae:membercount:category")
        .setPlaceholder("Select the category to create counters under")
        .addChannelTypes(ChannelType.GuildCategory),
    );
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const payload = {
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Member counter setup",
          description:
            "Select a category. The bot will create locked voice channels for Total, Online, Offline, Bots, Humans, Boosts, Voice, and Server Count.",
        }),
      ],
      components: [row],
    };
    if (interaction.deferred) await interaction.editReply(payload);
    else if (interaction.replied) await interaction.followUp({ ...payload, ephemeral: true });
    else await interaction.reply({ ...payload, ephemeral: true });
  },
};
