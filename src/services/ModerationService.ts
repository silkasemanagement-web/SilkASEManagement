import {
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";
import { ModerationLogModel } from "../models/ModerationLog.js";
import { WarningModel } from "../models/Warning.js";
import { randomUUID } from "node:crypto";
import type { Logger } from "../managers/LoggerManager.js";

export class ModerationService {
  constructor(private readonly log: Logger) {}

  private async logCase(params: {
    guildId: string;
    action: string;
    targetId?: string;
    moderatorId: string;
    reason?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
    evidenceUrls?: string[];
  }) {
    const caseId = randomUUID().slice(0, 8);
    await ModerationLogModel.create({ ...params, caseId });
    return caseId;
  }

  async ban(params: {
    interaction: ChatInputCommandInteraction<"cached">;
    target: GuildMember | User;
    reason?: string;
    deleteMessageSeconds?: number;
  }) {
    const { interaction, target, reason, deleteMessageSeconds } = params;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member?.bannable === false) {
      return { ok: false as const, message: "I cannot ban this member (role hierarchy)." };
    }
    await interaction.guild.members.ban(target.id, {
      reason: reason?.slice(0, 512),
      deleteMessageSeconds,
    });
    const caseId = await this.logCase({
      guildId: interaction.guild.id,
      action: "ban",
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    this.log.info({ caseId, guildId: interaction.guild.id, targetId: target.id }, "Member banned");
    return { ok: true as const, caseId };
  }

  async kick(params: {
    interaction: ChatInputCommandInteraction<"cached">;
    target: GuildMember;
    reason?: string;
  }) {
    const { interaction, target, reason } = params;
    if (!target.kickable) return { ok: false as const, message: "I cannot kick this member." };
    await target.kick(reason?.slice(0, 512));
    const caseId = await this.logCase({
      guildId: interaction.guild.id,
      action: "kick",
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    return { ok: true as const, caseId };
  }

  async timeout(params: {
    interaction: ChatInputCommandInteraction<"cached">;
    target: GuildMember;
    durationMs: number;
    reason?: string;
  }) {
    const { interaction, target, durationMs, reason } = params;
    if (!target.moderatable) return { ok: false as const, message: "I cannot timeout this member." };
    await target.timeout(durationMs, reason?.slice(0, 512));
    const caseId = await this.logCase({
      guildId: interaction.guild.id,
      action: "timeout",
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
      durationMs,
    });
    return { ok: true as const, caseId };
  }

  async warn(params: {
    interaction: ChatInputCommandInteraction<"cached">;
    targetId: string;
    reason: string;
    weight?: number;
  }) {
    const doc = await WarningModel.create({
      guildId: params.interaction.guild.id,
      userId: params.targetId,
      moderatorId: params.interaction.user.id,
      reason: params.reason,
      weight: params.weight ?? 1,
    });
    const caseId = await this.logCase({
      guildId: params.interaction.guild.id,
      action: "warn",
      targetId: params.targetId,
      moderatorId: params.interaction.user.id,
      reason: params.reason,
      metadata: { warningId: doc.id },
    });
    return { ok: true as const, caseId, warningId: String(doc._id) };
  }

  async purge(params: {
    interaction: ChatInputCommandInteraction<"cached">;
    amount: number;
    channelId?: string;
  }) {
    const channel = params.channelId
      ? await params.interaction.guild.channels.fetch(params.channelId)
      : params.interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      return { ok: false as const, message: "Invalid text channel." };
    }
    const deleted = await channel.bulkDelete(Math.min(params.amount, 100), true).catch(() => null);
    const count = deleted?.size ?? 0;
    await this.logCase({
      guildId: params.interaction.guild.id,
      action: "purge",
      moderatorId: params.interaction.user.id,
      metadata: { channelId: channel.id, count },
    });
    return { ok: true as const, count };
  }
}
