import { PermissionFlagsBits, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export const roleInfoCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("role-info")
    .setDescription("Show information about a selected Discord role.")
    .addRoleOption((option) => option.setName("role").setDescription("Role to inspect").setRequired(true)),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const rawRole = interaction.options.getRole("role", true);
    const role = await interaction.guild.roles.fetch(rawRole.id);
    if (!role) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Role info", description: "Role not found." })],
      });
      return;
    }

    const permissions = role.permissions.toArray();
    const importantPermissions = permissions
      .filter((permission) =>
        [
          "Administrator",
          "ManageGuild",
          "ManageRoles",
          "ManageChannels",
          "BanMembers",
          "KickMembers",
          "ModerateMembers",
          "ManageMessages",
        ].includes(permission),
      )
      .join(", ");

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: role.permissions.has(PermissionFlagsBits.Administrator) ? "alert" : "neutral",
          title: `Role info • ${role.name}`,
          fields: [
            { name: "Role", value: `${role}`, inline: true },
            { name: "Role ID", value: role.id, inline: true },
            { name: "Created", value: time(role.createdAt, TimestampStyles.LongDateTime), inline: false },
            { name: "Members", value: String(role.members.size), inline: true },
            { name: "Position", value: String(role.position), inline: true },
            { name: "Color", value: role.hexColor, inline: true },
            { name: "Hoisted", value: yesNo(role.hoist), inline: true },
            { name: "Mentionable", value: yesNo(role.mentionable), inline: true },
            { name: "Managed", value: yesNo(role.managed), inline: true },
            { name: "Key permissions", value: importantPermissions || "None" },
          ],
        }),
      ],
    });
  },
};
