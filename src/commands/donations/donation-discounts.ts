import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const donationDiscountsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("donation-discounts")
    .setDescription("Announce a donation discount to a selected channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel to send the donation discount announcement to.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("message").setDescription("Donation discount message to announce.").setRequired(true).setMaxLength(3500),
    ),
  meta: { cooldownMs: 10_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const raw = interaction.options.getChannel("channel", true);
    const channel = await interaction.guild.channels.fetch(raw.id).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Donation discounts", description: "Invalid announcement channel." })],
      });
      return;
    }

    const message = interaction.options.getString("message", true);
    const posted = await channel.send({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "donation",
          title: "Donation Discount",
          description: message,
        }),
      ],
    });

    await interaction.editReply({
      embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Donation discount posted", description: `[Jump to announcement](${posted.url})` })],
    });
  },
};
