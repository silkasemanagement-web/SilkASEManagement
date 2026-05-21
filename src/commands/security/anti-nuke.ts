import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const antiNukeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("anti-nuke")
    .setDescription("Enable, disable, or check anti-nuke protection.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("What to do with anti-nuke protection")
        .setRequired(true)
        .addChoices(
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
          { name: "Status", value: "status" },
        ),
    ),
  meta: { requireAdmin: true, cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const client = interaction.client as ArkBotClient;
    const mode = interaction.options.getString("mode", true);
    const cfg = await client.config.getGuild(interaction.guild.id);
    const enabled = mode === "status" ? (cfg.security?.antiNukeEnabled ?? true) : mode === "enable";
    const next =
      mode === "status"
        ? cfg
        : await client.config.updateGuild(interaction.guild.id, {
            security: { ...(cfg.security ?? {}), antiNukeEnabled: enabled },
          } as never);

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: enabled ? "ark" : "alert",
          title: "Anti-nuke protection",
          description:
            mode === "status"
              ? `Anti-nuke protection is currently **${enabled ? "enabled" : "disabled"}**.`
              : `Anti-nuke protection has been **${next.security?.antiNukeEnabled ? "enabled" : "disabled"}**.`,
          fields: [
            {
              name: "What this controls",
              value:
                "Stores the server-level anti-nuke switch used by the security system and config panel. Keep this enabled unless you are intentionally doing large admin changes.",
            },
          ],
        }),
      ],
    });
  },
};
