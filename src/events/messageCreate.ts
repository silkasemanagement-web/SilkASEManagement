import type { BotEvent } from "../interfaces/IEvent.js";
import type { Message } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { AutomodService } from "../automations/AutomodService.js";
import { AfkStatusModel } from "../models/AfkStatus.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { shouldBlockPlainMessage } from "../utils/commandOnlyChannel.js";
import { TicketRepository } from "../tickets/repository.js";

const automod = new AutomodService();

const AFK_MENTION_NOTICE_COOLDOWN_MS = 60_000;

export const messageCreateEvent = {
  name: "messageCreate" as const,
  execute(message: Message) {
    void processMessage(message).catch(() => null);
  },
} satisfies BotEvent;

async function processMessage(message: Message) {
  if (message.author.bot || !message.guild || !message.channel.isTextBased()) return;
  const client = message.client as ArkBotClient;
  if (!isManagedGuild(client.env, message.guild.id)) return;
  void TicketRepository.touchActivity(message.channel.id).catch(() => null);

  const cfg = await client.config.getGuild(message.guild.id);
  if (shouldBlockPlainMessage(message, cfg)) {
    await enforceCommandOnlyChannel(message);
    return;
  }
  await automod.evaluateMessage(client, message).catch(() => null);
  await clearAuthorAfk(message);
  await notifyAfkMentions(message);
  await handleMiniGames(client, message);
}

async function enforceCommandOnlyChannel(message: Message) {
  await message.delete().catch(() => null);
  const ch = message.channel;
  if (!ch.isTextBased() || !("send" in ch)) return;
  const notice = await ch
    .send({
      content: `${message.author}`,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Commands only",
          description: "This channel is for **slash commands only**. Please use `/help` to see what you can run here.",
        }),
      ],
      allowedMentions: { users: [message.author.id] },
    })
    .catch(() => null);
  if (notice) setTimeout(() => void notice.delete().catch(() => null), 6000);
}

async function clearAuthorAfk(message: Message) {
  const removed = await AfkStatusModel.findOneAndDelete({
    guildId: message.guild!.id,
    userId: message.author.id,
  }).lean();
  if (!removed) return;

  await message.reply({
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "ark",
        title: "Welcome back",
        description: `${message.author}, I removed your AFK status.`,
      }),
    ],
    allowedMentions: { users: [message.author.id] },
  }).catch(() => null);
}

async function notifyAfkMentions(message: Message) {
  const mentionedIds = [...message.mentions.users.keys()].filter((userId) => userId !== message.author.id);
  if (!mentionedIds.length) return;

  const afkUsers = await AfkStatusModel.find({
    guildId: message.guild!.id,
    userId: { $in: mentionedIds },
  }).lean();
  const now = Date.now();
  const notify = afkUsers.filter((afk) => {
    const lastNoticeAt = afk.lastMentionNoticeAt?.getTime() ?? 0;
    return now - lastNoticeAt >= AFK_MENTION_NOTICE_COOLDOWN_MS;
  });
  if (!notify.length) return;

  await AfkStatusModel.updateMany(
    { guildId: message.guild!.id, userId: { $in: notify.map((afk) => afk.userId) } },
    { $set: { lastMentionNoticeAt: new Date() } },
  ).catch(() => null);

  await message.reply({
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "neutral",
        title: "User is AFK",
        description: notify
          .slice(0, 5)
          .map((afk) => {
            const name = afk.usernameSnapshot ?? afk.userId;
            return `**${name}** is AFK: ${afk.reason}`;
          })
          .join("\n"),
      }),
    ],
    allowedMentions: { parse: [] },
  }).catch(() => null);
}

async function handleMiniGames(client: ArkBotClient, message: Message) {
  const numKey = `ae:event:number:${message.channel.id}`;
  const dinoKey = `ae:event:dino:${message.channel.id}`;
  const num = await client.cache.getJson<{ secret: number; endsAt: number }>(numKey);
  if (num && Date.now() < num.endsAt) {
    const guess = Number.parseInt(message.content.trim(), 10);
    if (!Number.isFinite(guess)) return;
    const cdKey = `ae:event:number:cd:${message.channel.id}:${message.author.id}`;
    const locked = await client.cache.redis.set(cdKey, "1", "EX", 3, "NX");
    if (locked !== "OK") return;
    if (guess === num.secret) {
      await message.reply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "ark",
            title: "Winner",
            description: `${message.author} guessed **${guess}** correctly!`,
          }),
        ],
      });
      await client.cache.del(numKey);
      return;
    }
    const hint = guess < num.secret ? "Higher" : "Lower";
    await message.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Guess",
          description: hint,
        }),
      ],
    });
    return;
  }
  const dino = await client.cache.getJson<{ answer: string; endsAt: number }>(dinoKey);
  if (dino && Date.now() < dino.endsAt) {
    if (message.content.trim().toLowerCase() === dino.answer) {
      await message.reply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "ark",
            title: "Correct species",
            description: `**${dino.answer}** — great job ${message.author}!`,
          }),
        ],
      });
      await client.cache.del(dinoKey);
    }
  }
}
