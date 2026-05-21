import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APIEmbed,
  type APIEmoji,
  type Guild,
  type GuildEmoji,
} from "discord.js";
import { TICKET_PANEL_IMAGE_ATTACHMENT, TICKET_PANEL_OPTIONS } from "./constants.js";

const SILK_RED = 0xff0033;

export function resolveGuildEmoji(guild: Guild, emojiName: string): GuildEmoji | null {
  return guild.emojis.cache.find((emoji) => emoji.name === emojiName) ?? null;
}

export function buildTicketPanelMenu(guild: Guild, emojiLookup?: Map<string, APIEmoji>) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ae:ticket:create")
      .setPlaceholder("Select a support ticket type")
      .addOptions(
        TICKET_PANEL_OPTIONS.map((option) => {
          const row = new StringSelectMenuOptionBuilder()
            .setLabel(option.label)
            .setDescription(option.description)
            .setValue(option.key);
          const apiEmoji = emojiLookup?.get(option.emojiName);
          const cachedEmoji = resolveGuildEmoji(guild, option.emojiName);
          if (apiEmoji?.id) row.setEmoji({ id: apiEmoji.id });
          else if (cachedEmoji) row.setEmoji({ id: cachedEmoji.id });
          return row;
        }),
      ),
  );
}

export function buildTicketPanelEmbed(input?: { title?: string; description?: string; color?: number }): APIEmbed {
  return new EmbedBuilder()
    .setColor(input?.color ?? SILK_RED)
    .setTitle(input?.title ?? "SILK™ Support Tickets")
    .setDescription(
      input?.description ??
        "Choose a ticket type below to open a **private** channel with staff.\n\nPlease include as much detail as possible so we can help you faster.",
    )
    .setImage(`attachment://${TICKET_PANEL_IMAGE_ATTACHMENT}`)
    .toJSON();
}
