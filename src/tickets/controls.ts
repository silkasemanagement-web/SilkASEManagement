import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { TICKET_CUSTOM_IDS } from "./constants.js";

export function buildTicketControlRow(options?: { includeTranscript?: boolean }) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TICKET_CUSTOM_IDS.claim).setLabel("Claim").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(TICKET_CUSTOM_IDS.close).setLabel("Close").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(TICKET_CUSTOM_IDS.lock).setLabel("Lock").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(TICKET_CUSTOM_IDS.unlock).setLabel("Unlock").setStyle(ButtonStyle.Secondary),
  );
  if (options?.includeTranscript) {
    row.addComponents(
      new ButtonBuilder().setCustomId(TICKET_CUSTOM_IDS.transcript).setLabel("Transcript").setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}
