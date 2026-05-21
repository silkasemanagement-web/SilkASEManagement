import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const colorRoleCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("color-role-create")
    .setDescription("Create a color role from hex (Discord displays role color in member list).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((o) => o.setName("hex").setDescription("#RRGGBB").setRequired(true).setMaxLength(7))
    .addStringOption((o) => o.setName("name").setDescription("Role name").setMaxLength(90)),
  meta: { cooldownMs: 15_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const hex = interaction.options.getString("hex", true).replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Color role",
            description: "Invalid hex color.",
          }),
        ],
      });
      return;
    }
    const color = Number.parseInt(hex, 16);
    const name = interaction.options.getString("name") ?? `#${hex.toUpperCase()}`;
    const role = await interaction.guild.roles.create({
      name,
      color,
      reason: "/color-role-create",
      mentionable: false,
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ae:rr:toggle:${role.id}`)
        .setLabel(`Select ${name}`.slice(0, 80))
        .setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({
      ephemeral: false,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Color role",
          description: `${role} was created as **${name}**.\nClick the button below to toggle this color role.`,
        }),
      ],
      components: [row],
    });
  },
};
