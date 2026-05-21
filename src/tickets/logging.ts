import type { APIEmbedField } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { readTickets } from "../core/guildConfigFields.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";

export type TicketLogAction =
  | "opened"
  | "closed"
  | "reopened"
  | "claimed"
  | "unclaimed"
  | "locked"
  | "unlocked"
  | "renamed"
  | "priority"
  | "escalated"
  | "participant_add"
  | "participant_remove"
  | "transcript"
  | "deleted"
  | "archived"
  | "error";

export async function logTicketEvent(
  client: ArkBotClient,
  guildId: string,
  action: TicketLogAction,
  params: {
    title: string;
    description: string;
    channelId?: string;
    userId?: string;
    fields?: APIEmbedField[];
  },
) {
  const cfg = await client.config.getGuild(guildId);
  const tickets = readTickets(cfg);
  const logChannelId = tickets.transcriptLogChannelId ?? cfg.modLogChannelId;
  if (!logChannelId) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const channel = await guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const theme = action === "error" ? "alert" : action === "opened" ? "ark" : "neutral";
  await channel
    .send({
      embeds: [
        DynamicEmbedBuilder.build({
          theme,
          title: `Ticket ${action}: ${params.title}`,
          description: params.description,
          fields: [
            ...(params.channelId ? [{ name: "Channel", value: `<#${params.channelId}>`, inline: true }] : []),
            ...(params.userId ? [{ name: "User", value: `<@${params.userId}>`, inline: true }] : []),
            ...(params.fields ?? []),
          ],
        }),
      ],
    })
    .catch((err) => client.log.warn({ err, guildId, action }, "Ticket log failed"));
}
