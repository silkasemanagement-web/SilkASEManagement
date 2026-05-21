import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import sharp from "sharp";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;

function normalizeEmojiName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 32);
}

function parseHexColor(input: string) {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  const value = Number.parseInt(hex, 16);
  return {
    hex: hex.toUpperCase(),
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

async function fetchAttachmentBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download attachment: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function buildEmojiImage(input: Buffer, color?: { r: number; g: number; b: number }) {
  let image = sharp(input, { animated: false })
    .resize(128, 128, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha();

  if (color) image = image.tint({ r: color.r, g: color.g, b: color.b });

  return image.png().toBuffer();
}

export const emojiAddCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("emoji-add")
    .setDescription("Add a custom static emoji from an uploaded image or screenshot.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addStringOption((o) =>
      o.setName("name").setDescription("Emoji name, like silk_rex or red_drop").setRequired(true).setMaxLength(32),
    )
    .addAttachmentOption((o) =>
      o.setName("image").setDescription("Upload the picture, screenshot, or file to turn into an emoji.").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("hex_color")
        .setDescription("Optional color tint, like #FF0033. Leave blank to keep the image colors.")
        .setMaxLength(7),
    ),
  meta: { cooldownMs: 15_000, requiredDiscordPermissions: [PermissionFlagsBits.ManageGuildExpressions] },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const name = normalizeEmojiName(interaction.options.getString("name", true));
    const attachment = interaction.options.getAttachment("image", true);
    const hexColorInput = interaction.options.getString("hex_color");
    const color = hexColorInput ? parseHexColor(hexColorInput) : undefined;

    if (name.length < 2) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Emoji add",
            description: "Emoji names must be at least 2 characters and can only use letters, numbers, and underscores.",
          }),
        ],
      });
      return;
    }

    if (hexColorInput && !color) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Emoji add",
            description: "Invalid color. Use a hex color like `#FF0033`.",
          }),
        ],
      });
      return;
    }

    if (attachment.contentType && !attachment.contentType.startsWith("image/")) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Emoji add",
            description: "Please attach an image file or screenshot.",
          }),
        ],
      });
      return;
    }

    if (attachment.size > MAX_INPUT_IMAGE_BYTES) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Emoji add",
            description: "That image is too large. Please upload an image under 10 MB.",
          }),
        ],
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const originalImage = await fetchAttachmentBuffer(attachment.url);
    const emojiImage = await buildEmojiImage(originalImage, color ?? undefined);
    const emoji = await interaction.guild.emojis.create({
      attachment: emojiImage,
      name,
      reason: `/emoji-add by ${interaction.user.tag}`,
    });

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Emoji added",
          description:
            `${emoji} **:${emoji.name}:** was added to **${interaction.guild.name}**.\n\n` +
            `Color tint: **${color ? `#${color.hex}` : "Original image colors"}**`,
        }),
      ],
    });
  },
};
