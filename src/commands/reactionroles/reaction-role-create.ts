import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { ReactionRolePanelModel } from "../../models/ReactionRolePanel.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const reactionRoleCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("reaction-role-create")
    .setDescription("Create a reaction role panel for an existing role.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((o) =>
      o.setName("name").setDescription("Reaction role panel name").setRequired(true).setMaxLength(200),
    )
    .addRoleOption((o) => o.setName("role").setDescription("Existing role to give/remove").setRequired(true))
    .addStringOption((o) =>
      o.setName("description").setDescription("Panel description").setMaxLength(3500),
    )
    .addChannelOption((o) => o.setName("channel").setDescription("Optional channel. Defaults to this channel.")),
  meta: { cooldownMs: 20_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const raw = interaction.options.getChannel("channel");
    const channel = raw ? await interaction.guild.channels.fetch(raw.id) : interaction.channel;
    if (!channel?.isTextBased() || !("send" in channel)) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({ theme: "alert", title: "Reaction roles", description: "Invalid channel." }),
        ],
      });
      return;
    }
    const title = interaction.options.getString("name", true);
    const description = interaction.options.getString("description") ?? "Pick a role below.";
    const r1 = interaction.options.getRole("role", true);
    const entries = [
      { id: "e1", roleId: r1.id, label: r1.name, style: "primary" as const },
    ];
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...entries.map((e) =>
        new ButtonBuilder()
          .setCustomId(`ae:rr:toggle:${e.roleId}`)
          .setLabel(e.label.slice(0, 80))
          .setStyle(e.style === "primary" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      ),
    );
    const embed = DynamicEmbedBuilder.build({ theme: "neutral", title, description });
    const msg = await channel.send({ embeds: [embed], components: [row] });
    await ReactionRolePanelModel.create({
      guildId: interaction.guild.id,
      channelId: channel.id,
      messageId: msg.id,
      mode: "button",
      title,
      description,
      entries,
    });
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Reaction role panel",
          description: `[Jump](${msg.url})`,
        }),
      ],
    });
  },
};
