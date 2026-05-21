import type { NonThreadGuildBasedChannel } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import {
  CHANNEL_NAME_SEP,
  convertCategoryName,
  convertChannelName,
  isNewChannelNameFormat,
  slugifyChannelLabel,
} from "../utils/channelNaming.js";

const NEW_CHANNEL_RENAME_WINDOW_MS = 60_000;

const CHANNEL_EMOJI_RULES: Array<{ emoji: string; keywords: string[]; weight?: number }> = [
  { emoji: "📢", keywords: ["announcement", "announcements", "announce", "news", "updates", "notice", "notices"], weight: 5 },
  { emoji: "📜", keywords: ["rule", "rules", "info", "information", "guide", "guides", "faq", "tos", "policy"], weight: 5 },
  { emoji: "👋", keywords: ["welcome", "start", "verify", "verification", "intro", "introductions", "join"], weight: 5 },
  { emoji: "💬", keywords: ["chat", "general", "talk", "lounge", "community", "hangout", "discussion"], weight: 4 },
  { emoji: "🎮", keywords: ["game", "gaming", "play", "lfg", "looking", "queue", "ps4", "ps5", "playstation", "sony"], weight: 5 },
  { emoji: "🦖", keywords: ["ase", "ark", "survival", "evolved", "dino", "dinos", "rex", "raptor", "wyvern", "creature", "tame", "tames", "breeding", "egg"], weight: 8 },
  { emoji: "🗺️", keywords: ["map", "maps", "island", "ragnarok", "fjordur", "center", "genesis", "aberration", "extinction"], weight: 6 },
  { emoji: "🏰", keywords: ["base", "bases", "build", "building", "raid", "raiding", "pvp", "defense"], weight: 6 },
  { emoji: "⚔️", keywords: ["war", "fight", "battle", "battlefield", "duel", "arena", "combat"], weight: 6 },
  { emoji: "🎉", keywords: ["event", "events", "party", "celebrate", "celebration"], weight: 6 },
  { emoji: "🎁", keywords: ["giveaway", "giveaways", "reward", "rewards", "prize", "claim", "drop"], weight: 7 },
  { emoji: "🎫", keywords: ["ticket", "tickets", "support", "help", "appeal", "appeals", "report", "reports"], weight: 7 },
  { emoji: "🛡️", keywords: ["admin", "staff", "mod", "moderator", "manager", "logs", "audit", "security"], weight: 7 },
  { emoji: "💰", keywords: ["donation", "donate", "vip", "shop", "store", "purchase", "payment", "paypal", "cashapp"], weight: 7 },
  { emoji: "🤝", keywords: ["tribe", "tribes", "alliance", "ally", "team", "squad", "clan", "recruit"], weight: 6 },
  { emoji: "📊", keywords: ["stats", "count", "counter", "leaderboard", "rank", "ranking", "score", "scores", "points"], weight: 6 },
  { emoji: "🔊", keywords: ["voice", "vc", "call", "talking", "meeting"], weight: 6 },
  { emoji: "🎵", keywords: ["music", "radio", "song", "songs", "playlist", "dj"], weight: 6 },
  { emoji: "📷", keywords: ["media", "photo", "photos", "screenshot", "screenshots", "clip", "clips", "video", "videos"], weight: 6 },
  { emoji: "💡", keywords: ["suggest", "suggestion", "suggestions", "idea", "ideas", "feedback"], weight: 6 },
  { emoji: "🔒", keywords: ["private", "locked", "secret", "hidden", "confidential"], weight: 6 },
  { emoji: "🧪", keywords: ["test", "testing", "beta", "dev", "development", "staging"], weight: 5 },
  { emoji: "🤖", keywords: ["bot", "bots", "commands", "command", "automation"], weight: 6 },
  { emoji: "🛒", keywords: ["market", "trade", "trading", "sell", "buy", "auction", "marketplace"], weight: 6 },
  { emoji: "📅", keywords: ["schedule", "calendar", "date", "time", "timeline", "wipe", "restart"], weight: 6 },
  { emoji: "🚨", keywords: ["alert", "alerts", "emergency", "urgent", "warning", "warn"], weight: 7 },
  { emoji: "✅", keywords: ["approved", "complete", "completed", "done", "success"], weight: 5 },
  { emoji: "❌", keywords: ["denied", "rejected", "failed", "fail", "closed"], weight: 5 },
  { emoji: "📚", keywords: ["resource", "resources", "docs", "documentation", "library", "manual"], weight: 5 },
  { emoji: "🌐", keywords: ["global", "server", "servers", "network", "cluster"], weight: 4 },
];

function pickChannelEmoji(name: string) {
  const normalized = name.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);
  let best: { emoji: string; score: number } | null = null;

  for (const rule of CHANNEL_EMOJI_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (wordSet.has(keyword)) score += rule.weight ?? 1;
      else if (words.some((word) => word.includes(keyword) || keyword.includes(word))) score += 1;
    }
    if (score > (best?.score ?? 0)) best = { emoji: rule.emoji, score };
  }

  return best?.emoji ?? "📌";
}

function stripExistingEmoji(name: string) {
  return name.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]+\s*/u, "");
}

function formatChannelName(name: string, isCategory: boolean) {
  const converted = isCategory ? convertCategoryName(name) : convertChannelName(name);
  if (converted) return converted.slice(0, 100);
  const baseName = stripExistingEmoji(name);
  const emoji = pickChannelEmoji(baseName);
  const slug = slugifyChannelLabel(baseName) || "channel";
  return `${emoji}${CHANNEL_NAME_SEP}${slug}`.slice(0, 100);
}

export const channelCreateEvent = {
  name: "channelCreate" as const,
  async execute(channel: NonThreadGuildBasedChannel) {
    const client = channel.client as ArkBotClient;
    if (!isManagedGuild(client.env, channel.guild.id)) return;
    if (!("setName" in channel)) return;
    if (!("name" in channel) || !channel.name) return;
    if (Date.now() - channel.createdTimestamp > NEW_CHANNEL_RENAME_WINDOW_MS) return;
    if (isNewChannelNameFormat(channel.name)) return;

    const nextName = formatChannelName(channel.name, channel.type === 4);
    await channel.setName(nextName, "Automatic channel naming format").catch((err) => {
      client.log.warn({ err, channelId: channel.id, nextName }, "Failed to apply channel name format");
    });
  },
} satisfies BotEvent;
