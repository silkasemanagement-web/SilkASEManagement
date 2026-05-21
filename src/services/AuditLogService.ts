import type { APIEmbedField, Client, Guild, MessageCreateOptions, MessagePayload } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";

export const MAX_AUDIT_LOG_CHANNEL_ID = "1239402379602825320";

const MAX_FIELD_VALUE = 1000;
const MAX_DESCRIPTION = 3900;
const MAX_TITLE = 240;
const LIVE_EVENT_WINDOW_MS = 2 * 60_000;
const DEDUPE_WINDOW_MS = 30_000;
const recentAuditKeys = new Map<string, number>();

export type AuditLogInput = {
  guildId?: string;
  guild?: Guild | null;
  title: string;
  description?: string;
  fields?: APIEmbedField[];
  sourceChannelId?: string | null;
  sourceUserId?: string | null;
  eventId?: string | null;
  occurredAt?: Date | number | null;
  force?: boolean;
};

type SendableChannel = {
  send(options: string | MessagePayload | MessageCreateOptions): Promise<unknown>;
};

function truncate(value: unknown, max = MAX_FIELD_VALUE) {
  const text = value === undefined || value === null ? "Unknown" : String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 15))}\n... truncated`;
}

function sanitize(value: unknown, max = MAX_FIELD_VALUE) {
  return truncate(value, max)
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere")
    .replace(/<@&/g, "<@\u200b&")
    .replace(/<@/g, "<@\u200b");
}

function safeFields(fields: APIEmbedField[] = []) {
  return fields.slice(0, 20).map((field) => ({
    name: truncate(field.name, 240),
    value: sanitize(field.value, MAX_FIELD_VALUE) || "None",
    inline: field.inline,
  }));
}

async function resolveGuild(client: ArkBotClient, input: AuditLogInput) {
  if (input.guild) return input.guild;
  if (!input.guildId) return null;
  return client.guilds.cache.get(input.guildId) ?? (await client.guilds.fetch(input.guildId).catch(() => null));
}

export class AuditLogService {
  static shouldSkip(client: Client, input: AuditLogInput) {
    return input.sourceChannelId === MAX_AUDIT_LOG_CHANNEL_ID && input.sourceUserId === client.user?.id && !input.force;
  }

  private static isFresh(input: AuditLogInput) {
    if (input.force || !input.occurredAt) return true;
    const occurredAt = input.occurredAt instanceof Date ? input.occurredAt.getTime() : input.occurredAt;
    return Date.now() - occurredAt <= LIVE_EVENT_WINDOW_MS;
  }

  private static dedupeKey(guildId: string, input: AuditLogInput) {
    return [
      guildId,
      input.eventId ?? input.title,
      input.sourceChannelId ?? "no-channel",
      input.sourceUserId ?? "no-user",
      input.description ?? "no-description",
    ].join("|");
  }

  private static isDuplicate(guildId: string, input: AuditLogInput) {
    if (input.force) return false;
    const now = Date.now();
    for (const [key, seenAt] of recentAuditKeys) {
      if (now - seenAt > DEDUPE_WINDOW_MS) recentAuditKeys.delete(key);
    }

    const key = this.dedupeKey(guildId, input);
    const seenAt = recentAuditKeys.get(key);
    if (seenAt && now - seenAt <= DEDUPE_WINDOW_MS) return true;
    recentAuditKeys.set(key, now);
    return false;
  }

  static async log(client: ArkBotClient, input: AuditLogInput) {
    if (this.shouldSkip(client, input)) return;
    if (!this.isFresh(input)) return;

    const guild = await resolveGuild(client, input);
    if (!guild || !isManagedGuild(client.env, guild.id)) return;
    if (this.isDuplicate(guild.id, input)) return;

    const channel = await guild.channels.fetch(MAX_AUDIT_LOG_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    await (channel as SendableChannel)
      .send({
        allowedMentions: { parse: [] },
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "ark",
            title: sanitize(input.title, MAX_TITLE),
            description: sanitize(input.description ?? "No details.", MAX_DESCRIPTION),
            fields: safeFields(input.fields),
          }),
        ],
      })
      .catch((err: unknown) => {
        client.log.warn({ err, title: input.title }, "Failed to send audit log");
      });
  }

  static async internal(client: ArkBotClient, title: string, details: Record<string, unknown> = {}) {
    const guildIds = [client.env.MAIN_GUILD_ID, client.env.DONATION_GUILD_ID];
    await Promise.all(
      guildIds.map((guildId) =>
        this.log(client, {
          guildId,
          title,
          description: "Internal bot event.",
          fields: Object.entries(details).map(([name, value]) => ({
            name,
            value: typeof value === "object" ? JSON.stringify(value, null, 2) : String(value),
          })),
          force: true,
        }),
      ),
    );
  }
}
