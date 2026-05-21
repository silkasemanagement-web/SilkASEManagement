import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { readTicketCategoryMap, readTickets } from "../core/guildConfigFields.js";
import { isStaff } from "../utils/discord.js";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_CUSTOM_IDS,
  TICKET_PARENT_CATEGORY_IDS,
  type TicketCategoryKey,
} from "./constants.js";
import { TicketRepository } from "./repository.js";
import { TicketService } from "./service.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { acknowledgeEphemeral, acknowledgeTicketSelect, replyWithEmbed } from "../utils/interactionAck.js";
import { exportTicketTranscript } from "./transcript.js";

const ticketSelectInFlight = new Set<string>();

export async function handleTicketCreateSelect(client: ArkBotClient, interaction: StringSelectMenuInteraction) {
  const ack = await acknowledgeTicketSelect(client, interaction);
  if (ack === false) return;
  const replyMode = ack;

  if (!interaction.guild) {
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Tickets", description: "Use this inside a server." }), replyMode);
    return;
  }

  try {
    const key = interaction.values[0] as TicketCategoryKey;
    const label = TICKET_CATEGORY_LABELS[key] ?? key;
    const [cfg, opener] = await Promise.all([
      client.config.getGuild(interaction.guild.id),
      interaction.member && "user" in interaction.member
        ? interaction.guild.members.fetch(interaction.user.id)
        : interaction.guild.members.fetch(interaction.user.id),
    ]);
    const tickets = readTickets(cfg);
    const parentId = readTicketCategoryMap(cfg)[key] ?? TICKET_PARENT_CATEGORY_IDS[key];
    if (!parentId) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Tickets", description: `No category for **${label}**. Staff: \`/tickets configs category\`.` }), replyMode);
      return;
    }
    const svc = new TicketService(client);
    const staffRoleIds = await svc.resolveStaffRoleIds(interaction.guild, tickets.staffRoleIds ?? [], cfg.staffRoleIds ?? []);
    const res = await svc.createTicket({
      guild: interaction.guild,
      opener,
      categoryKey: key,
      parentCategoryId: parentId,
      staffRoleIds,
      openedVia: "panel",
      maxOpenPerUser: tickets.maxOpenPerUser,
      welcomeMessage: tickets.welcomeMessage ?? undefined,
    });
    if (!res.ok) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Ticket failed", description: res.message }), replyMode);
      return;
    }
    await replyWithEmbed(
      client,
      interaction,
      DynamicEmbedBuilder.build({ theme: "ark", title: "Ticket opened", description: `**#${res.ticketNumber}** → <#${res.channelId}>` }),
      replyMode,
    );
  } catch (err) {
    client.log.error({ err, interactionId: interaction.id }, "Ticket panel failed");
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Error", description: "Could not create your ticket. Try again." }), replyMode);
  }
}

export async function handleTicketButton(client: ArkBotClient, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.inGuild() || !interaction.channel?.isTextBased()) {
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Tickets", description: "Use this inside a ticket channel." }));
    return;
  }

  const cfg = await client.config.getGuild(interaction.guild.id);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const staff = isStaff(member, cfg);
  const svc = new TicketService(client);
  const channel = interaction.channel as import("discord.js").GuildTextBasedChannel;

  if (interaction.customId === TICKET_CUSTOM_IDS.claim) {
    if (!staff) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Claim", description: "Staff only." }));
      return;
    }
    const res = await svc.claimTicket(channel, interaction.user.id);
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: res.ok ? "ark" : "alert", title: "Claim", description: res.ok ? "Ticket claimed." : res.message }));
    return;
  }

  if (interaction.customId === TICKET_CUSTOM_IDS.close) {
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Close", description: "Not a ticket channel." }));
      return;
    }
    const res = await svc.closeTicket({
      guild: interaction.guild,
      channel,
      closedById: interaction.user.id,
      reason: staff ? "Closed via button" : "Closed by opener",
      requesterId: interaction.user.id,
      isStaff: staff,
    });
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: res.ok ? "ark" : "alert", title: "Close", description: res.ok ? `Ticket #${res.ticketNumber} closed.` : res.message }));
    return;
  }

  if (interaction.customId === TICKET_CUSTOM_IDS.lock || interaction.customId === TICKET_CUSTOM_IDS.unlock) {
    if (!staff) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Lock", description: "Staff only." }));
      return;
    }
    const res =
      interaction.customId === TICKET_CUSTOM_IDS.lock
        ? await svc.lockTicket(channel, interaction.user.id)
        : await svc.unlockTicket(channel, interaction.user.id);
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: res.ok ? "ark" : "alert", title: "Lock", description: res.ok ? "Updated." : res.message }));
    return;
  }

  if (interaction.customId === TICKET_CUSTOM_IDS.transcript) {
    if (!staff) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Transcript", description: "Staff only." }));
      return;
    }
    const doc = await TicketRepository.findByChannel(channel.id);
    if (!doc) {
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "alert", title: "Transcript", description: "Not a ticket." }));
      return;
    }
    if (!client.queues.heavyQueue) {
      await exportTicketTranscript(client, { ticketId: String(doc._id), channelId: channel.id, guildId: interaction.guild.id, closedById: interaction.user.id, deleteChannel: false });
      await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "ark", title: "Transcript", description: "Transcript exported to log channel." }));
      return;
    }
    await svc.enqueueOrRunTranscript({ ticketId: String(doc._id), channelId: channel.id, guildId: interaction.guild.id, closedById: interaction.user.id, deleteChannel: false });
    await replyWithEmbed(client, interaction, DynamicEmbedBuilder.build({ theme: "ark", title: "Transcript", description: "Transcript queued." }));
  }
}

export async function routeTicketInteraction(client: ArkBotClient, interaction: StringSelectMenuInteraction | ButtonInteraction) {
  if (interaction.isStringSelectMenu() && interaction.customId === TICKET_CUSTOM_IDS.createSelect) {
    if (ticketSelectInFlight.has(interaction.id)) return;
    ticketSelectInFlight.add(interaction.id);
    try {
      await handleTicketCreateSelect(client, interaction);
    } finally {
      ticketSelectInFlight.delete(interaction.id);
    }
    return true;
  }
  if (interaction.isButton() && interaction.customId.startsWith("ae:ticket:")) {
    if (!interaction.deferred && !interaction.replied) {
      const acked = await acknowledgeEphemeral(client, interaction);
      if (!acked) return true;
    }
    await handleTicketButton(client, interaction);
    return true;
  }
  return false;
}
