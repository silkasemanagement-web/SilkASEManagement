import { SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const serverCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("server").setDescription("Show information about this Discord server."),
  meta: { cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const guild = await interaction.guild.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    await guild.channels.fetch().catch(() => null);
    await guild.roles.fetch().catch(() => null);

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: `Server • ${guild.name}`,
          thumbnailURL: guild.iconURL({ extension: "png", size: 512 }) ?? undefined,
          fields: [
            { name: "Server ID", value: guild.id, inline: true },
            { name: "Owner", value: owner ? `${owner.user.tag} (${owner.id})` : "Unknown", inline: true },
            { name: "Created", value: time(guild.createdAt, TimestampStyles.LongDateTime), inline: true },
            { name: "Members", value: guild.memberCount.toLocaleString("en-US"), inline: true },
            { name: "Channels", value: String(guild.channels.cache.size), inline: true },
            { name: "Roles", value: String(guild.roles.cache.size), inline: true },
            { name: "Boosts", value: String(guild.premiumSubscriptionCount ?? 0), inline: true },
            { name: "Verification", value: String(guild.verificationLevel), inline: true },
          ],
        }),
      ],
    });
  },
};
