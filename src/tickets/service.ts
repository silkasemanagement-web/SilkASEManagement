import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { Logger } from "../managers/LoggerManager.js";
import {
  DEFAULT_CREATE_COOLDOWN_MS,
  DEFAULT_MAX_OPEN_PER_USER,
  MAX_CHANNELS_PER_CATEGORY,
  TICKET_CATEGORY_LABELS,
  type TicketCategoryKey,
  type TicketPriority,
} from "./constants.js";
import { buildTicketControlRow } from "./controls.js";
import { logTicketEvent } from "./logging.js";
import {
  buildTicketPermissionOverwrites,
  describeChannelCreateError,
  resolveTicketStaffRoleIds,
} from "./permissions.js";
import { TicketRepository } from "./repository.js";
import { exportTicketTranscript } from "./transcript.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function channelNameForTicket(ticketNumber: number, categoryKey: TicketCategoryKey, username: string) {
  const cat = slugify(TICKET_CATEGORY_LABELS[categoryKey] ?? categoryKey) || "ticket";
  const user = slugify(username) || "user";
  return `ticket-${ticketNumber}-${cat}-${user}`.slice(0, 100);
}

const createCooldowns = new Map<string, number>();

export class TicketService {
  constructor(private readonly client: ArkBotClient, private readonly log?: Logger) {}

  async resolveStaffRoleIds(guild: Guild, cfgStaff: string[], globalStaff: string[]) {
    return resolveTicketStaffRoleIds(guild, [...cfgStaff, ...globalStaff]);
  }

  async createTicket(params: {
    guild: Guild;
    opener: GuildMember;
    categoryKey: TicketCategoryKey;
    parentCategoryId: string;
    staffRoleIds: string[];
    openedVia?: "panel" | "slash" | "button" | "modal";
    panelName?: string;
    maxOpenPerUser?: number;
    welcomeMessage?: string;
  }): Promise<{ ok: true; channelId: string; ticketNumber: number } | { ok: false; message: string }> {
    const { guild, opener, categoryKey, parentCategoryId, staffRoleIds, openedVia = "panel", panelName, welcomeMessage } = params;
    const maxOpen = params.maxOpenPerUser ?? DEFAULT_MAX_OPEN_PER_USER;

    const cooldownKey = `${guild.id}:${opener.id}`;
    const lastCreate = createCooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastCreate < DEFAULT_CREATE_COOLDOWN_MS) {
      const waitSec = Math.ceil((DEFAULT_CREATE_COOLDOWN_MS - (Date.now() - lastCreate)) / 1000);
      return { ok: false, message: `Please wait **${waitSec}s** before opening another ticket.` };
    }

    const openCount = await TicketRepository.countOpenForUser(guild.id, opener.id);
    if (openCount >= maxOpen) {
      return { ok: false, message: `You already have **${openCount}** open ticket(s). Maximum allowed: **${maxOpen}**.` };
    }

    const duplicate = await TicketRepository.findOpenDuplicate(guild.id, opener.id, categoryKey);
    if (duplicate) {
      return { ok: false, message: `You already have an open **${TICKET_CATEGORY_LABELS[categoryKey]}** ticket: <#${duplicate.channelId}>.` };
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { ok: false, message: "The bot needs **Manage Channels** to open tickets." };
    }

    const parent = (await guild.channels.fetch(parentCategoryId).catch(() => null)) as CategoryChannel | null;
    if (!parent || parent.type !== ChannelType.GuildCategory) {
      return { ok: false, message: "Ticket category is missing or invalid. Use `/tickets configs category`." };
    }

    const childCount =
      parent.children?.cache.size ?? guild.channels.cache.filter((c) => c.parentId === parent.id).size;
    if (childCount >= MAX_CHANNELS_PER_CATEGORY) {
      return { ok: false, message: `**${parent.name}** is full (${MAX_CHANNELS_PER_CATEGORY} channels).` };
    }

    const validStaffRoleIds = await resolveTicketStaffRoleIds(guild, staffRoleIds);
    const ticketNumber = await TicketRepository.nextTicketNumber(guild.id);

    let channel;
    try {
      channel = await guild.channels.create({
        name: channelNameForTicket(ticketNumber, categoryKey, opener.user.username),
        type: ChannelType.GuildText,
        parent,
        permissionOverwrites: buildTicketPermissionOverwrites({
          guildId: guild.id,
          openerId: opener.id,
          botMemberId: me.id,
          staffRoleIds: validStaffRoleIds,
        }),
        reason: `Ticket #${ticketNumber} opened by ${opener.user.tag}`,
        topic: `Ticket #${ticketNumber} · ${TICKET_CATEGORY_LABELS[categoryKey]} · ${opener.user.tag}`,
      });
    } catch (err) {
      this.log?.error({ err, categoryKey, parentCategoryId }, "Ticket channel create failed");
      return { ok: false, message: describeChannelCreateError(err) };
    }

    await TicketRepository.create({
      guildId: guild.id,
      ticketNumber,
      channelId: channel.id,
      openerId: opener.id,
      categoryKey,
      participants: [opener.id],
      openedVia,
      panelName,
    });

    createCooldowns.set(cooldownKey, Date.now());
    await this.postWelcome(guild, channel.id, opener.id, categoryKey, ticketNumber, welcomeMessage);

    void logTicketEvent(this.client, guild.id, "opened", {
      title: `#${ticketNumber}`,
      description: `<@${opener.id}> opened **${TICKET_CATEGORY_LABELS[categoryKey]}**`,
      channelId: channel.id,
      userId: opener.id,
    });

    this.log?.info({ channelId: channel.id, ticketNumber, categoryKey }, "Ticket created");
    return { ok: true, channelId: channel.id, ticketNumber };
  }

  async postWelcome(
    guild: Guild,
    channelId: string,
    openerId: string,
    categoryKey: TicketCategoryKey,
    ticketNumber: number,
    customMessage?: string,
  ) {
    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as GuildTextBasedChannel | null;
    if (!channel?.isTextBased()) return;

    const label = TICKET_CATEGORY_LABELS[categoryKey] ?? categoryKey;
    await channel.send({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: `${label} · Ticket #${ticketNumber}`,
          description:
            customMessage?.trim() ||
            `<@${openerId}> thanks for contacting support.\n\nDescribe your issue with as much detail as possible. A staff member will assist you shortly.`,
        }),
      ],
      components: [buildTicketControlRow({ includeTranscript: true })],
    });
  }

  async enqueueOrRunTranscript(payload: {
    ticketId: string;
    channelId: string;
    guildId: string;
    closedById: string;
    deleteChannel?: boolean;
  }) {
    if (this.client.queues.heavyQueue) {
      await this.client.queues.enqueue("export_ticket_transcript", payload);
      return { queued: true as const };
    }
    await exportTicketTranscript(this.client, payload);
    return { queued: false as const };
  }

  async closeTicket(params: {
    guild: Guild;
    channel: GuildTextBasedChannel;
    closedById: string;
    reason: string;
    requesterId: string;
    isStaff: boolean;
    deleteAfterTranscript?: boolean;
  }) {
    const doc = await TicketRepository.findByChannel(params.channel.id);
    if (!doc) return { ok: false as const, message: "Not a registered ticket channel." };
    if (doc.status === "archived") return { ok: false as const, message: "Ticket is already archived." };
    if (!params.isStaff && doc.openerId !== params.requesterId) {
      return { ok: false as const, message: "Only staff or the ticket opener can close this ticket." };
    }

    await TicketRepository.setStatus(params.channel.id, "closed", {
      closedById: params.closedById,
      closeReason: params.reason.slice(0, 1024),
    } as never);

    if ("permissionOverwrites" in params.channel) {
      await params.channel.permissionOverwrites
        .edit(params.guild.id, { SendMessages: false })
        .catch(() => null);
      if (doc.openerId) {
        await params.channel.permissionOverwrites
          .edit(doc.openerId, { SendMessages: false })
          .catch(() => null);
      }
    }

    await this.enqueueOrRunTranscript({
      ticketId: String(doc._id),
      channelId: params.channel.id,
      guildId: params.guild.id,
      closedById: params.closedById,
      deleteChannel: params.deleteAfterTranscript !== false,
    });

    void logTicketEvent(this.client, params.guild.id, "closed", {
      title: `#${doc.ticketNumber}`,
      description: params.reason,
      channelId: params.channel.id,
      userId: params.closedById,
    });

    return { ok: true as const, ticketNumber: doc.ticketNumber };
  }

  async reopenTicket(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    if (doc.status === "archived") {
      return { ok: false as const, message: "Archived tickets cannot be reopened (channel was deleted)." };
    }
    await TicketRepository.setStatus(channel.id, "open", {
      closedById: undefined,
      closeReason: undefined,
      locked: false,
    } as never);
    if ("permissionOverwrites" in channel && doc.openerId) {
      await channel.permissionOverwrites.edit(doc.openerId, { SendMessages: true }).catch(() => null);
      await channel.permissionOverwrites.edit(channel.guild.id, { SendMessages: false }).catch(() => null);
    }
    void logTicketEvent(this.client, channel.guild.id, "reopened", {
      title: `#${doc.ticketNumber}`,
      description: `Reopened by <@${staffId}>`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async lockTicket(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    await TicketRepository.updateByChannel(channel.id, { locked: true, status: "locked" } as never);
    if ("permissionOverwrites" in channel) {
      await channel.permissionOverwrites.edit(channel.guild.id, { SendMessages: false }).catch(() => null);
      if (doc.openerId) await channel.permissionOverwrites.edit(doc.openerId, { SendMessages: false }).catch(() => null);
    }
    void logTicketEvent(this.client, channel.guild.id, "locked", {
      title: `#${doc.ticketNumber}`,
      description: `Locked by <@${staffId}>`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async unlockTicket(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    const status = doc.claimedById ? "claimed" : "open";
    await TicketRepository.updateByChannel(channel.id, { locked: false, status } as never);
    if ("permissionOverwrites" in channel && doc.openerId) {
      await channel.permissionOverwrites.edit(doc.openerId, { SendMessages: true }).catch(() => null);
    }
    void logTicketEvent(this.client, channel.guild.id, "unlocked", {
      title: `#${doc.ticketNumber}`,
      description: `Unlocked by <@${staffId}>`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async claimTicket(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    if (["closed", "archived"].includes(doc.status)) return { ok: false as const, message: "Ticket is closed." };
    await TicketRepository.setStatus(channel.id, "claimed", { claimedById: staffId } as never);
    const base = channel.name.replace(/^claimed-/i, "").replace(/^ticket-\d+-/i, "ticket-");
    if ("setName" in channel) await channel.setName(`claimed-${base}`.slice(0, 100)).catch(() => null);
    void logTicketEvent(this.client, channel.guild.id, "claimed", {
      title: `#${doc.ticketNumber}`,
      description: `<@${staffId}> claimed this ticket`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async unclaimTicket(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    await TicketRepository.setStatus(channel.id, "open", { claimedById: undefined } as never);
    if ("setName" in channel) {
      const name = channel.name.replace(/^claimed-/i, "");
      await channel.setName(name.slice(0, 100)).catch(() => null);
    }
    void logTicketEvent(this.client, channel.guild.id, "unclaimed", {
      title: `#${doc.ticketNumber}`,
      description: `<@${staffId}> removed the claim`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async addParticipant(guild: Guild, channelId: string, userId: string) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !("permissionOverwrites" in channel)) {
      return { ok: false as const, message: "Invalid ticket channel." };
    }
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    await TicketRepository.addParticipant(channelId, userId);
    return { ok: true as const };
  }

  async removeParticipant(guild: Guild, channelId: string, userId: string) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !("permissionOverwrites" in channel)) {
      return { ok: false as const, message: "Invalid ticket channel." };
    }
    await channel.permissionOverwrites.delete(userId);
    await TicketRepository.removeParticipant(channelId, userId);
    return { ok: true as const };
  }

  async renameTicket(guild: Guild, channelId: string, name: string) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !("setName" in channel)) return { ok: false as const, message: "Cannot rename." };
    await channel.setName(name.slice(0, 100), "Ticket rename");
    return { ok: true as const };
  }

  async setPriority(channelId: string, priority: TicketPriority) {
    await TicketRepository.setPriority(channelId, priority);
    return { ok: true as const };
  }

  async escalate(channel: GuildTextBasedChannel, staffId: string) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    const order: TicketPriority[] = ["low", "normal", "high", "urgent"];
    const idx = order.indexOf(doc.priority as TicketPriority);
    const next = order[Math.min(idx + 1, order.length - 1)] ?? "urgent";
    await TicketRepository.setPriority(channel.id, next);
    void logTicketEvent(this.client, channel.guild.id, "escalated", {
      title: `#${doc.ticketNumber}`,
      description: `Priority → **${next}** by <@${staffId}>`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const, priority: next };
  }

  async addNote(channelId: string, staffId: string, note: string) {
    const line = `[${new Date().toISOString()}] <@${staffId}>: ${note.trim()}`;
    await TicketRepository.addNote(channelId, line);
    return { ok: true as const };
  }

  async deleteTicket(guild: Guild, channel: GuildTextBasedChannel, staffId: string, exportFirst = true) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) return { ok: false as const, message: "Not a ticket channel." };
    if (exportFirst) {
      await this.enqueueOrRunTranscript({
        ticketId: String(doc._id),
        channelId: channel.id,
        guildId: guild.id,
        closedById: staffId,
        deleteChannel: true,
      });
    } else {
      await channel.delete("Ticket deleted").catch(() => null);
      await TicketRepository.setStatus(channel.id, "archived");
    }
    void logTicketEvent(this.client, guild.id, "deleted", {
      title: `#${doc.ticketNumber}`,
      description: `Deleted by <@${staffId}>`,
      channelId: channel.id,
      userId: staffId,
    });
    return { ok: true as const };
  }

  async getStats(guildId: string) {
    return TicketRepository.guildStats(guildId);
  }

  async closeAllTickets(params: { guild: Guild; staffId: string; reason?: string }) {
    const { guild, staffId, reason = "Bulk close by staff" } = params;
    const docs = await TicketRepository.findByGuild(guild.id, ["open", "claimed", "locked", "closed"]);
    let closed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      const channel = (await guild.channels.fetch(doc.channelId).catch(() => null)) as GuildTextBasedChannel | null;
      if (!channel?.isTextBased()) {
        await TicketRepository.setStatus(doc.channelId, "archived", { closeReason: "Channel missing (bulk close)" });
        skipped++;
        continue;
      }
      if (doc.status === "archived") continue;
      const res = await this.closeTicket({
        guild,
        channel,
        closedById: staffId,
        reason,
        requesterId: staffId,
        isStaff: true,
      });
      if (res.ok) closed++;
      else {
        skipped++;
        if (errors.length < 5) errors.push(`#${doc.ticketNumber}: ${res.message}`);
      }
    }

    void logTicketEvent(this.client, guild.id, "closed", {
      title: "Bulk close",
      description: `Closed **${closed}** ticket(s) by <@${staffId}>`,
      userId: staffId,
    });

    return { closed, skipped, total: docs.length, errors };
  }

  async deleteAllTickets(params: { guild: Guild; staffId: string; exportTranscripts?: boolean }) {
    const { guild, staffId, exportTranscripts = true } = params;
    const docs = await TicketRepository.findByGuild(guild.id);
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      const channel = (await guild.channels.fetch(doc.channelId).catch(() => null)) as GuildTextBasedChannel | null;
      if (!channel?.isTextBased()) {
        await TicketRepository.setStatus(doc.channelId, "archived", { closeReason: "Channel missing (bulk delete)" });
        skipped++;
        continue;
      }
      const res = await this.deleteTicket(guild, channel, staffId, exportTranscripts);
      if (res.ok) deleted++;
      else {
        skipped++;
        if (errors.length < 5) errors.push(`#${doc.ticketNumber}: ${res.message}`);
      }
    }

    void logTicketEvent(this.client, guild.id, "deleted", {
      title: "Bulk delete",
      description: `Deleted **${deleted}** ticket(s) by <@${staffId}>`,
      userId: staffId,
    });

    return { deleted, skipped, total: docs.length, errors };
  }

  /** Record message activity; call from messageCreate for ticket channels */
  async onTicketMessage(channelId: string, authorId: string) {
    await TicketRepository.touchActivity(channelId);
    const doc = await TicketRepository.findByChannelLean(channelId);
    if (!doc) return;
    const isOpener = authorId === doc.openerId;
    if (!isOpener) {
      await TicketRepository.recordStaffResponse(channelId);
    }
  }
}

/** @deprecated Use TicketService with ArkBotClient — kept for gradual migration */
export async function resolveTicketStaffRoleIdsExport(guild: Guild, staffRoleIds: string[]) {
  return resolveTicketStaffRoleIds(guild, staffRoleIds);
}
