import {
  ActionRowBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";

const CONFIG_SECTIONS = [
  { id: "staff_roles", label: "Staff / Admin / Helper roles" },
  { id: "logging", label: "Logging channels" },
  { id: "automod", label: "Auto moderation toggles" },
  { id: "tickets", label: "Ticket system" },
  { id: "suggestions", label: "Suggestions" },
  { id: "scheduling", label: "Scheduling / ASE PS4-PS5 alerts" },
] as const;

export function buildConfigMenu(selected?: string) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ae:config:section")
    .setPlaceholder("Choose another configuration area")
    .addOptions(
      CONFIG_SECTIONS.map((s) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(s.label)
          .setValue(s.id)
          .setDefault(selected === s.id),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export const configCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Interactive configuration dashboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  meta: { requireAdmin: true, cooldownMs: 4000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const client = interaction.client as ArkBotClient;
    const cfg = await client.config.getGuild(interaction.guild.id);
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "SILK™ ASE PS4/PS5 configuration",
          description:
            "Legacy interactive panel. Prefer category commands: `/moderation configs`, `/welcome configs`, `/automod configs`, `/logging configs`, `/security configs`, `/tickets configs`, `/economy configs`, and more (see `/help`).",
          fields: [
            {
              name: "Staff roles",
              value: cfg.staffRoleIds?.map((id) => `<@&${id}>`).join(", ") || "_None_",
            },
            {
              name: "Admin roles",
              value: cfg.adminRoleIds?.map((id) => `<@&${id}>`).join(", ") || "_None_",
            },
            {
              name: "Moderation log",
              value: cfg.modLogChannelId ? `<#${cfg.modLogChannelId}>` : "_Not set_",
            },
            {
              name: "Ticket panel",
              value: cfg.tickets?.panelChannelId ? `<#${cfg.tickets.panelChannelId}>` : "_Not set_",
            },
          ],
        }),
      ],
      components: [buildConfigMenu()],
    });
  },
};
