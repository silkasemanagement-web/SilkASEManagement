import { SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const userCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Show information about a Discord user.")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to inspect").setRequired(false),
    ),
  meta: { cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const roles = member
      ? member.roles.cache
          .filter((role) => role.id !== interaction.guild!.id)
          .sort((a, b) => b.position - a.position)
          .map((role) => `${role}`)
          .slice(0, 20)
      : [];

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: `User • ${user.tag}`,
          thumbnailURL: user.displayAvatarURL({ extension: "png", size: 512, forceStatic: false }),
          fields: [
            { name: "User ID", value: user.id, inline: true },
            { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
            { name: "Created", value: time(user.createdAt, TimestampStyles.LongDateTime), inline: false },
            {
              name: "Joined",
              value: member?.joinedAt ? time(member.joinedAt, TimestampStyles.LongDateTime) : "Not in this server",
              inline: false,
            },
            { name: "Highest role", value: member?.roles.highest ? `${member.roles.highest}` : "None", inline: true },
            { name: "Role count", value: String(Math.max(0, (member?.roles.cache.size ?? 1) - 1)), inline: true },
            { name: "Roles", value: roles.length ? roles.join(", ").slice(0, 1024) : "None" },
          ],
        }),
      ],
    });
  },
};
