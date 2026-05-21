import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ColorResolvable,
  type APIEmbedField,
} from "discord.js";
import type { EmbedThemeName } from "../embeds/themes.js";
import { EMBED_THEMES } from "../embeds/themes.js";

const SILK_BANNER_URL = process.env.SILK_BANNER_URL;
const SILK_ICON_URL = process.env.SILK_ICON_URL;
const SILK_BRAND_NAME = "SILK™ ASE | PS4/PS5 | 300+ POP";
const SILK_RED = 0xff0033;

export interface RichEmbedInput {
  theme?: EmbedThemeName;
  title?: string;
  description?: string;
  color?: ColorResolvable;
  author?: { name: string; iconURL?: string; url?: string };
  thumbnailURL?: string;
  imageURL?: string;
  footer?: { text: string; iconURL?: string };
  fields?: APIEmbedField[];
  timestamp?: Date | number;
  url?: string;
}

export class DynamicEmbedBuilder {
  static build(input: RichEmbedInput): EmbedBuilder {
    const theme = input.theme ? EMBED_THEMES[input.theme] : EMBED_THEMES.neutral;
    const embed = new EmbedBuilder()
      .setColor(SILK_RED)
      .setTitle(input.title ?? null)
      .setDescription(input.description ?? null)
      .setURL(input.url ?? null);

    if (input.author) {
      embed.setAuthor({
        name: input.author.name,
        iconURL: input.author.iconURL ?? SILK_ICON_URL ?? theme.authorIcon,
        url: input.author.url,
      });
    } else {
      embed.setAuthor({
        name: SILK_BRAND_NAME,
        iconURL: SILK_ICON_URL ?? theme.authorIcon,
      });
    }
    embed.setThumbnail(input.thumbnailURL ?? SILK_ICON_URL ?? null);
    embed.setImage(input.imageURL ?? SILK_BANNER_URL ?? null);
    if (input.footer) embed.setFooter({ text: input.footer.text, iconURL: input.footer.iconURL ?? SILK_ICON_URL });
    else embed.setFooter({ text: SILK_BRAND_NAME, iconURL: SILK_ICON_URL });
    if (input.fields?.length) embed.addFields(input.fields);
    if (input.timestamp !== undefined) embed.setTimestamp(input.timestamp);
    else embed.setTimestamp(new Date());
    return embed;
  }

  static paginatedEmbeds(pages: RichEmbedInput[]): EmbedBuilder[] {
    return pages.map((p) => this.build({ ...p, timestamp: p.timestamp ?? new Date() }));
  }

  static paginationRow(customIdBase: string, page: number, total: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${customIdBase}:first:${page}`)
        .setLabel("⏮")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`${customIdBase}:prev:${page}`)
        .setLabel("◀")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`${customIdBase}:noop`)
        .setLabel(`${page + 1}/${total}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`${customIdBase}:next:${page}`)
        .setLabel("▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= total - 1),
      new ButtonBuilder()
        .setCustomId(`${customIdBase}:last:${page}`)
        .setLabel("⏭")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= total - 1),
    );
  }
}
