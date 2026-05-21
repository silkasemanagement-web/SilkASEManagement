import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type VoiceChannel,
} from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";

export const MEMBER_COUNTER_TYPES = [
  "total_members",
  "online_members",
  "offline_members",
  "bots",
  "humans",
  "nitro_boosts",
  "voice_active",
  "server_count",
] as const;

export type MemberCounterType = (typeof MEMBER_COUNTER_TYPES)[number];

export const MEMBER_COUNTER_LABELS: Record<MemberCounterType, string> = {
  total_members: "Total Members",
  online_members: "Online Members",
  offline_members: "Offline Members",
  bots: "Bots",
  humans: "Humans",
  nitro_boosts: "Nitro Boosts",
  voice_active: "Active Voice Members",
  server_count: "Server Count",
};

const EMOJI: Record<MemberCounterType, string> = {
  total_members: "👥",
  online_members: "🟢",
  offline_members: "⚫",
  bots: "🤖",
  humans: "🧑",
  nitro_boosts: "💎",
  voice_active: "🔊",
  server_count: "🌐",
};

type CounterEntry = {
  channelId: string;
  type: MemberCounterType;
  parentCategoryId?: string;
};

const timers = new Map<string, NodeJS.Timeout>();
const running = new Set<string>();
let periodicStarted = false;

function format(n: number) {
  return n.toLocaleString("en-US");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function counterName(guild: Guild, type: MemberCounterType) {
  const cachedMembers = guild.members.cache;
  const members = Math.max(guild.memberCount, cachedMembers.size);
  const bots = cachedMembers.filter((m) => m.user.bot).size;
  const humans = cachedMembers.size ? cachedMembers.filter((m) => !m.user.bot).size : Math.max(0, members - bots);
  const voice = guild.channels.cache
    .filter((ch) => ch.isVoiceBased())
    .reduce((sum, ch) => sum + (ch.members?.size ?? 0), 0);
  const onlineFromPresence = cachedMembers.filter((m) => m.presence?.status && m.presence.status !== "offline").size;
  const online = Math.max(guild.approximatePresenceCount ?? 0, onlineFromPresence);
  const value =
    type === "bots"
      ? bots
      : type === "humans"
        ? humans
        : type === "online_members"
          ? online
          : type === "offline_members"
            ? Math.max(0, members - online)
            : type === "nitro_boosts"
              ? (guild.premiumSubscriptionCount ?? 0)
              : type === "voice_active"
                ? voice
                : type === "server_count"
                  ? guild.client.guilds.cache.size
                  : members;
  const slug =
    type === "total_members"
      ? "members"
      : type === "online_members"
        ? "online"
        : type === "offline_members"
          ? "offline"
          : type === "nitro_boosts"
            ? "boosts"
            : type === "voice_active"
              ? "active-voice"
              : type === "server_count"
                ? "servers"
                : type;
  return `${EMOJI[type]}┃${slug}-${format(value).replace(/,/g, "")}`.slice(0, 100);
}

async function entries(client: ArkBotClient, guildId: string): Promise<CounterEntry[]> {
  const cfg = await client.config.getGuild(guildId);
  return ((cfg.stats?.memberCounters as CounterEntry[] | undefined) ?? []).filter(Boolean);
}

export async function createMemberCounterChannel(params: {
  client: ArkBotClient;
  guild: Guild;
  categoryId: string;
  type: MemberCounterType;
}) {
  const parent = (await params.guild.channels.fetch(params.categoryId).catch(() => null)) as
    | CategoryChannel
    | null;
  if (!parent || parent.type !== ChannelType.GuildCategory) return null;
  await params.guild.members.fetch().catch(() => null);
  const channel = await params.guild.channels.create({
    name: counterName(params.guild, params.type),
    type: ChannelType.GuildVoice,
    parent,
    permissionOverwrites: [
      { id: params.guild.id, deny: [PermissionFlagsBits.Connect] },
      {
        id: params.guild.members.me!.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
      },
    ],
    reason: "Live member counter",
  });
  const cfg = await params.client.config.getGuild(params.guild.id);
  const current = ((cfg.stats?.memberCounters as CounterEntry[] | undefined) ?? []).filter(
    (c) => c.type !== params.type,
  );
  await params.client.config.updateGuild(params.guild.id, {
    stats: {
      ...(cfg.stats ?? {}),
      updateIntervalMs: 15_000,
      memberCounters: [
        ...current,
        { channelId: channel.id, type: params.type, parentCategoryId: params.categoryId },
      ],
    },
  } as never);
  return channel;
}

export function scheduleMemberCounterRefresh(client: ArkBotClient, guildId: string, debounceMs = 15_000) {
  const existing = timers.get(guildId);
  if (existing) clearTimeout(existing);
  timers.set(
    guildId,
    setTimeout(() => {
      timers.delete(guildId);
      void refreshMemberCounters(client, guildId).catch((err) =>
        client.log.warn({ err, guildId }, "Member counter refresh failed"),
      );
    }, debounceMs),
  );
}

export function startMemberCounterRefreshLoop(client: ArkBotClient) {
  if (periodicStarted) return;
  periodicStarted = true;

  const run = () => {
    for (const guildId of [client.env.MAIN_GUILD_ID, client.env.DONATION_GUILD_ID]) {
      void refreshMemberCounters(client, guildId).catch((err) =>
        client.log.warn({ err, guildId }, "Periodic member counter refresh failed"),
      );
    }
  };

  setTimeout(run, 10_000);
  setInterval(run, 60_000);
}

export async function refreshMemberCounters(client: ArkBotClient, guildId: string) {
  if (running.has(guildId)) {
    scheduleMemberCounterRefresh(client, guildId, 30_000);
    return;
  }
  running.add(guildId);
  try {
    const guild = await client.guilds.fetch({ guild: guildId, withCounts: true }).catch(() => null);
    if (!guild) return;
    await guild.members.fetch().catch(() => null);
    await guild.channels.fetch().catch(() => null);
    const all = await entries(client, guildId);
    for (const entry of all) {
      const channel = (await guild.channels.fetch(entry.channelId).catch(() => null)) as VoiceChannel | null;
      if (!channel || channel.type !== ChannelType.GuildVoice) continue;
      const next = counterName(guild, entry.type);
      if (channel.name !== next) {
        await channel.setName(next, "Live member counter refresh").catch((err) => {
          client.log.warn({ err, channelId: channel.id }, "Counter rename skipped");
        });
        await sleep(3500);
      }
    }
  } finally {
    running.delete(guildId);
  }
}
