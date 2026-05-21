import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const eventVoiceLastLeaveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-voice-lastleave")
    .setDescription("Voice last-leave event scaffolding (extend with collectors + voice state hooks).")
    .addChannelOption((o) => o.setName("channel").setDescription("Voice channel").setRequired(true)),
  meta: { requireStaff: true, cooldownMs: 120_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const ch = interaction.options.getChannel("channel", true);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "donation",
          title: "Voice event",
          description: `Selected <#${ch.id}>.\n\nWire-up steps:\n• Post signup panel with buttons\n• Track \`voiceStateUpdate\` for joins/leaves\n• Award winner + optional ticket creation`,
        }),
      ],
    });
  },
};
