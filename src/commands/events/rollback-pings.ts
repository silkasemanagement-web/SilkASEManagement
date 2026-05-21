import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

const ROLLBACK_CHANNEL_ID = "1505800134284542075";

const ASE_MAPS = [
  "The Island",
  "The Center",
  "Scorched Earth",
  "Ragnarok",
  "Aberration",
  "Extinction",
  "Valguero",
  "Genesis Part 1",
  "Crystal Isles",
  "Genesis Part 2",
  "Lost Island",
  "Fjordur",
] as const;

export const rollbackPingsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("rollback-pings")
    .setDescription("Announce an ASE map rollback to the rollback ping channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName("map")
        .setDescription("ASE map that was rolled back.")
        .setRequired(true)
        .addChoices(...ASE_MAPS.map((map) => ({ name: map, value: map }))),
    )
    .addStringOption((o) =>
      o.setName("rollback").setDescription("How long the rollback was, in your own words.").setRequired(true).setMaxLength(1000),
    ),
  meta: { cooldownMs: 10_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const channel = await interaction.guild.channels.fetch(ROLLBACK_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Rollback ping", description: "Rollback announcement channel was not found." })],
      });
      return;
    }

    const map = interaction.options.getString("map", true);
    const rollback = interaction.options.getString("rollback", true);
    const posted = await channel.send({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "ASE Rollback Announcement",
          description: `**Map:** ${map}\n**Rollback:** ${rollback}`,
        }),
      ],
    });

    await interaction.editReply({
      embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Rollback ping posted", description: `[Jump to announcement](${posted.url})` })],
    });
  },
};
