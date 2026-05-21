import { ChannelType, OverwriteType, PermissionFlagsBits, type Guild } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { HeavyJobPayloads } from "../managers/QueueManager.js";
import { TicketModel } from "../models/Ticket.js";
import { TicketRepository } from "../tickets/repository.js";
import { TICKET_VIEW_PERMS, BOT_TICKET_PERMS } from "../tickets/permissions.js";
import { exportTicketTranscript } from "../tickets/transcript.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { GiveawayModel } from "../models/Giveaway.js";
import { AuditLogService } from "../services/AuditLogService.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type MassRoleProgress = {
  ok: number;
  fail: number;
  skipped: number;
  total: number;
  processed: number;
};

export async function processHeavyJob(client: ArkBotClient, name: string, data: unknown) {
  await AuditLogService.internal(client, "Heavy job started", { name, data });
  switch (name) {
    case "export_ticket_transcript":
      await runExportTicketTranscript(client, data as HeavyJobPayloads["export_ticket_transcript"]);
      await AuditLogService.internal(client, "Heavy job finished", { name });
      return;
    case "mass_role_apply":
      await massRoleApply(client, data as HeavyJobPayloads["mass_role_apply"]);
      await AuditLogService.internal(client, "Heavy job finished", { name });
      return;
    default:
      client.log.warn({ name }, "Unhandled heavy job (noop)");
      await AuditLogService.internal(client, "Heavy job skipped", { name, data });
  }
}

async function runExportTicketTranscript(
  client: ArkBotClient,
  payload: HeavyJobPayloads["export_ticket_transcript"],
) {
  await exportTicketTranscript(client, {
    ticketId: payload.ticketId,
    channelId: payload.channelId,
    guildId: payload.guildId,
    closedById: payload.closedById,
    deleteChannel: true,
  });
}

export async function massRoleApply(
  client: ArkBotClient,
  payload: HeavyJobPayloads["mass_role_apply"],
  onProgress?: (progress: MassRoleProgress) => Promise<void>,
) {
  const { guildId, roleId, action } = payload;
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { ok: 0, fail: 0, skipped: 0, total: 0, processed: 0 };
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return { ok: 0, fail: 0, skipped: 0, total: 0, processed: 0 };
  await guild.members.fetch().catch(() => null);
  const members = [...guild.members.cache.values()].filter((m) => !m.user.bot);
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  let processed = 0;
  await onProgress?.({ ok, fail, skipped, total: members.length, processed });
  for (let i = 0; i < members.length; i += 5) {
    const slice = members.slice(i, i + 5);
    await Promise.all(
      slice.map(async (m) => {
        try {
          const alreadyHasRole = m.roles.cache.has(role.id);
          if (action === "add" && alreadyHasRole) {
            skipped++;
            return;
          }
          if (action === "remove" && !alreadyHasRole) {
            skipped++;
            return;
          }

          if (action === "add") await m.roles.add(role, "mass_role_apply");
          else await m.roles.remove(role, "mass_role_apply");
          ok++;
        } catch (err) {
          client.log.warn({ err, guildId, roleId, userId: m.id, action }, "Mass role member update failed");
          fail++;
        } finally {
          processed++;
        }
      }),
    );
    await onProgress?.({ ok, fail, skipped, total: members.length, processed });
    await sleep(2000);
  }
  const result = { ok, fail, skipped, total: members.length, processed };
  client.log.info({ guildId, roleId, action, ...result }, "Mass role job finished");
  await AuditLogService.log(client, {
    guildId,
    title: "Mass role job finished",
    description: `Mass role ${action} operation finished.`,
    fields: [
      { name: "Role ID", value: roleId, inline: true },
      { name: "Updated", value: String(ok), inline: true },
      { name: "Skipped", value: String(skipped), inline: true },
      { name: "Failed", value: String(fail), inline: true },
      { name: "Total", value: String(members.length), inline: true },
    ],
    force: true,
  });
  return result;
}

async function createGiveawayWinnerTicket(params: {
  client: ArkBotClient;
  guild: Guild;
  winnerId: string;
  prize: string;
  giveawayId: string;
  giveawayMessageUrl: string;
}) {
  const { client, guild, winnerId, prize, giveawayId, giveawayMessageUrl } = params;
  const member = await guild.members.fetch(winnerId).catch(() => null);
  if (!member) return null;
  const cfg = await client.config.getGuild(guild.id);
  const staffRoleIds = new Set([
    ...(cfg.adminRoleIds ?? []),
    ...(cfg.staffRoleIds ?? []),
    ...(cfg.tickets?.staffRoleIds ?? []),
  ]);

  const existingTicket = await TicketModel.findOne({
    guildId: guild.id,
    openerId: winnerId,
    categoryKey: "giveaway_winner",
    "tags": `giveaway:${giveawayId}`,
    status: { $in: ["open", "claimed"] },
  }).lean();
  if (existingTicket) return existingTicket.channelId;

  const permissionOverwrites = [
    { id: guild.id, type: OverwriteType.Role, deny: PermissionFlagsBits.ViewChannel },
    { id: member.id, type: OverwriteType.Member, allow: TICKET_VIEW_PERMS },
    { id: guild.members.me!.id, type: OverwriteType.Member, allow: BOT_TICKET_PERMS },
    ...[...staffRoleIds].map((roleId) => ({
      id: roleId,
      type: OverwriteType.Role,
      allow: TICKET_VIEW_PERMS,
    })),
  ];

  const winnerChannel = await guild.channels
    .create({
      name: `giveaway-winner-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90),
      type: ChannelType.GuildText,
      reason: "Giveaway winner ticket channel",
      permissionOverwrites,
    })
    .catch((err: unknown) => {
      client.log.warn({ err, guildId: guild.id, winnerId }, "Failed to create giveaway winner ticket channel");
      void AuditLogService.log(client, {
        guildId: guild.id,
        title: "Giveaway winner ticket failed",
        description: `Failed to create a winner ticket for <@${winnerId}>.`,
        fields: [{ name: "Error", value: err instanceof Error ? err.message : String(err) }],
        force: true,
      });
      return null;
    });

  if (!winnerChannel?.isTextBased()) {
    await AuditLogService.log(client, {
      guildId: guild.id,
      title: "Giveaway winner ticket failed",
      description: `Winner ticket channel was not created for <@${winnerId}>.`,
      force: true,
    });
    return null;
  }

  const ticketNumber = await TicketRepository.nextTicketNumber(guild.id);
  await TicketModel.create({
    guildId: guild.id,
    ticketNumber,
    channelId: winnerChannel.id,
    openerId: winnerId,
    categoryKey: "giveaway_winner",
    participants: [winnerId],
    tags: [`giveaway:${giveawayId}`, "giveaway_winner"],
    openedVia: "slash",
  });

  await winnerChannel.send({
    content: `${member}`,
    allowedMentions: { users: [member.id] },
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "donation",
        title: "Congratulations, giveaway winner!",
        description:
          `You won **${prize}**.\n\nPlease tell staff in this ticket which giveaway you won and wait for help claiming your reward.\n` +
          `[Giveaway message](${giveawayMessageUrl})`,
      }),
    ],
  });

  await AuditLogService.log(client, {
    guildId: guild.id,
    title: "Giveaway winner ticket created",
    description: `Created <#${winnerChannel.id}> for <@${winnerId}>.`,
    fields: [
      { name: "Prize", value: prize },
      { name: "Giveaway", value: giveawayMessageUrl },
    ],
    force: true,
  });

  return winnerChannel.id;
}

/** Ends due giveaways, notifies winners, updates the public message. */
export async function processDueGiveaways(client: ArkBotClient, messageId?: string) {
  const due = await GiveawayModel.find({
    status: "active",
    endsAt: { $lte: new Date() },
    ...(messageId ? { messageId } : {}),
  })
    .limit(15)
    .lean();

  for (const g of due) {
    const guild = client.guilds.cache.get(g.guildId) ?? (await client.guilds.fetch(g.guildId).catch(() => null));
    if (!guild) continue;
    const ch = await guild.channels.fetch(g.channelId).catch(() => null);
    const msg = ch?.isTextBased() ? await ch.messages.fetch(g.messageId).catch(() => null) : null;
    const pool = g.entrants?.length ? [...g.entrants] : [];
    if (pool.length === 0) pool.push(g.hostId);
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const winnerCount = Math.min(g.winnerCount ?? 1, shuffled.length);
    const winnerIds = shuffled.slice(0, winnerCount);

    const lock = await GiveawayModel.updateOne(
      { _id: g._id, status: "active", endsAt: { $lte: new Date() } },
      { $set: { status: "ended", winnerIds } },
    );
    if (lock.modifiedCount === 0) continue;

    for (const wid of winnerIds) {
      const u = await client.users.fetch(wid).catch(() => null);
      if (u) {
        await u
          .send({
            embeds: [
              DynamicEmbedBuilder.build({
                theme: "donation",
                title: "You won a giveaway",
                description: `**${g.prize}**\n[Goto message](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`,
              }),
            ],
          })
          .catch(() => null);
      }
      await createGiveawayWinnerTicket({
        client,
        guild,
        winnerId: wid,
        prize: g.prize,
        giveawayId: String(g._id),
        giveawayMessageUrl: `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`,
      });
    }

    if (msg) {
      await msg
        .edit({
          embeds: [
            DynamicEmbedBuilder.build({
              theme: "ark",
              title: "Giveaway ended",
              description:
                `**Prize:** ${g.prize}\n` +
                `Winners: ${winnerIds.map((id) => `<@${id}>`).join(", ") || "None"}`,
            }),
          ],
          components: [],
        })
        .catch(() => null);
    }
  }
}
