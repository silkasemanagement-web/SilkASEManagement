import { AttachmentBuilder, type GuildTextBasedChannel, type Message } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { readTickets } from "../core/guildConfigFields.js";
import { TicketRepository } from "./repository.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { TRANSCRIPT_MESSAGE_LIMIT } from "./constants.js";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function fetchTicketMessages(channel: GuildTextBasedChannel, maxMessages = TRANSCRIPT_MESSAGE_LIMIT) {
  const collected: Message[] = [];
  let before: string | undefined;
  while (collected.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    collected.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

export function buildTicketTranscriptHtml(params: {
  guildName: string;
  channelName: string;
  ticketId: string;
  ticketNumber: number;
  messages: Message[];
}) {
  const rows = params.messages
    .map((m) => {
      const ts = new Date(m.createdTimestamp).toISOString();
      const author = escapeHtml(m.author.tag);
      const content = escapeHtml(m.content || "");
      const embedNote = m.embeds.length > 0 ? ` <em>[${m.embeds.length} embed(s)]</em>` : "";
      const attachments = m.attachments.size > 0 ? ` <em>[${m.attachments.size} attachment(s)]</em>` : "";
      return `<tr><td class="ts">${escapeHtml(ts)}</td><td class="au">${author}</td><td class="tx">${content}${embedNote}${attachments}</td></tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Ticket #${params.ticketNumber}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f1115;color:#e6e9ef;margin:0;padding:24px;}
h1{font-size:1.1rem;margin:0 0 8px;}
.meta{color:#8b919d;font-size:0.85rem;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;font-size:0.9rem;}
th,td{border-bottom:1px solid #23262d;padding:8px 6px;vertical-align:top;}
th{background:#1a1d24;color:#9aa3b2;}
.ts{white-space:nowrap;color:#7d8590;width:180px;}
.au{width:200px;color:#89b4fa;}
</style></head><body>
<h1>${escapeHtml(params.guildName)} — #${escapeHtml(params.channelName)}</h1>
<div class="meta">Ticket #${params.ticketNumber} · ID ${escapeHtml(params.ticketId)} · ${params.messages.length} messages</div>
<table><thead><tr><th>UTC</th><th>Author</th><th>Content</th></tr></thead>
<tbody>${rows || "<tr><td colspan='3'>No messages.</td></tr>"}</tbody></table></body></html>`;
}

export function buildTicketTranscriptTxt(params: {
  guildName: string;
  channelName: string;
  ticketNumber: number;
  messages: Message[];
}) {
  const header = `=== ${params.guildName} | #${params.channelName} | Ticket #${params.ticketNumber} ===\n\n`;
  const body = params.messages
    .map((m) => {
      const ts = new Date(m.createdTimestamp).toISOString();
      const line = m.content || "[no text]";
      const extra = [
        m.embeds.length ? `[${m.embeds.length} embed(s)]` : "",
        m.attachments.size ? `[${m.attachments.size} attachment(s)]` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `[${ts}] ${m.author.tag}: ${line}${extra ? ` ${extra}` : ""}`;
    })
    .join("\n");
  return header + (body || "No messages.");
}

export async function exportTicketTranscript(client: ArkBotClient, params: {
  ticketId: string;
  channelId: string;
  guildId: string;
  closedById: string;
  deleteChannel?: boolean;
}) {
  const { ticketId, channelId, guildId, closedById, deleteChannel = true } = params;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { ok: false as const, message: "Guild not found." };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await TicketRepository.setStatus(channelId, "archived", { closeReason: "Channel missing during export" } as never);
    return { ok: false as const, message: "Ticket channel not found." };
  }

  const doc = await TicketRepository.findByChannelLean(channelId);
  const messages = await fetchTicketMessages(channel, TRANSCRIPT_MESSAGE_LIMIT);
  const ticketNumber = doc?.ticketNumber ?? 0;

  const html = buildTicketTranscriptHtml({
    guildName: guild.name,
    channelName: "name" in channel ? String(channel.name) : "ticket",
    ticketId,
    ticketNumber,
    messages,
  });
  const txt = buildTicketTranscriptTxt({
    guildName: guild.name,
    channelName: "name" in channel ? String(channel.name) : "ticket",
    ticketNumber,
    messages,
  });

  const htmlFile = new AttachmentBuilder(Buffer.from(html, "utf8"), { name: `ticket-${ticketNumber}.html` });
  const txtFile = new AttachmentBuilder(Buffer.from(txt, "utf8"), { name: `ticket-${ticketNumber}.txt` });

  const cfg = await client.config.getGuild(guildId);
  const tickets = readTickets(cfg);
  const logId = tickets.transcriptLogChannelId ?? cfg.modLogChannelId;
  let transcriptUrl: string | undefined;

  if (logId) {
    const logCh = await guild.channels.fetch(logId).catch(() => null);
    if (logCh?.isTextBased()) {
      const posted = await logCh
        .send({
          embeds: [
            DynamicEmbedBuilder.build({
              theme: "neutral",
              title: `Ticket #${ticketNumber} transcript`,
              description: `Closed by <@${closedById}> · Opener <@${doc?.openerId ?? "unknown"}> · <#${channelId}>`,
            }),
          ],
          files: [htmlFile, txtFile],
        })
        .catch(() => null);
      transcriptUrl = posted?.url;
    }
  }

  await TicketRepository.updateByChannel(channelId, {
    status: "archived",
    transcriptMessageUrl: transcriptUrl,
  } as never);

  if (deleteChannel && channel.isTextBased()) {
    await channel.delete("Ticket closed — transcript exported").catch(() => null);
  }

  return { ok: true as const, transcriptUrl };
}
