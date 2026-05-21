import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

function parseEmojiId(input: string) {
  const customEmojiMatch = input.match(/^<a?:\w+:(\d{17,20})>$/);
  if (customEmojiMatch?.[1]) return customEmojiMatch[1];
  if (/^\d{17,20}$/.test(input)) return input;
  return null;
}

export const emojiRemoveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("emoji-remove")
    .setDescription("Remove a custom emoji from this Discord.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addStringOption((o) =>
      o.setName("emoji").setDescription("Emoji mention, emoji ID, or emoji name to remove.").setRequired(true).setMaxLength(100),
    ),
  meta: { cooldownMs: 15_000, requiredDiscordPermissions: [PermissionFlagsBits.ManageGuildExpressions] },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const input = interaction.options.getString("emoji", true).trim();
    const emojiId = parseEmojiId(input);
    const emoji =
      (emojiId ? await interaction.guild.emojis.fetch(emojiId).catch(() => null) : null) ??
      interaction.guild.emojis.cache.find((guildEmoji) => guildEmoji.name?.toLowerCase() === input.toLowerCase());

    if (!emoji) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Emoji remove",
            description: "I could not find that custom emoji in this Discord. Use the emoji itself, its ID, or its exact name.",
          }),
        ],
      });
      return;
    }

    const emojiName = emoji.name ?? input;
    await emoji.delete(`/emoji-remove by ${interaction.user.tag}`);

    await interaction.reply({
      ephemeral: false,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Emoji removed",
          description: `Removed **:${emojiName}:** from **${interaction.guild.name}**.`,
        }),
      ],
    });
  },
};
