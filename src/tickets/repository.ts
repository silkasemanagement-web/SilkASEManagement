import { TicketModel } from "../models/Ticket.js";
import type { TicketCategoryKey, TicketPriority, TicketStatus } from "./constants.js";

export class TicketRepository {
  static async nextTicketNumber(guildId: string) {
    const latest = await TicketModel.findOne({ guildId }).sort({ ticketNumber: -1 }).select("ticketNumber").lean();
    return (latest?.ticketNumber ?? 0) + 1;
  }

  static findByChannel(channelId: string) {
    return TicketModel.findOne({ channelId });
  }

  static findByChannelLean(channelId: string) {
    return TicketModel.findOne({ channelId }).lean();
  }

  static countOpenForUser(guildId: string, openerId: string) {
    return TicketModel.countDocuments({
      guildId,
      openerId,
      status: { $in: ["open", "claimed", "locked"] },
    });
  }

  static findOpenDuplicate(guildId: string, openerId: string, categoryKey: TicketCategoryKey) {
    return TicketModel.findOne({
      guildId,
      openerId,
      categoryKey,
      status: { $in: ["open", "claimed", "locked"] },
    }).lean();
  }

  static create(data: {
    guildId: string;
    ticketNumber: number;
    channelId: string;
    openerId: string;
    categoryKey: TicketCategoryKey;
    participants: string[];
    openedVia?: string;
    panelName?: string;
  }) {
    return TicketModel.create(data);
  }

  static updateByChannel(channelId: string, patch: Record<string, unknown>) {
    return TicketModel.updateOne({ channelId }, { $set: { ...patch, lastActivityAt: new Date() } });
  }

  static addParticipant(channelId: string, userId: string) {
    return TicketModel.updateOne({ channelId }, { $addToSet: { participants: userId }, $set: { lastActivityAt: new Date() } });
  }

  static removeParticipant(channelId: string, userId: string) {
    return TicketModel.updateOne({ channelId }, { $pull: { participants: userId }, $set: { lastActivityAt: new Date() } });
  }

  static touchActivity(channelId: string) {
    return TicketModel.updateOne({ channelId }, { $set: { lastActivityAt: new Date() }, $inc: { "analytics.messageCount": 1 } });
  }

  static recordStaffResponse(channelId: string) {
    return TicketModel.updateOne(
      { channelId, "analytics.firstStaffResponseAt": { $exists: false } },
      { $set: { "analytics.firstStaffResponseAt": new Date() }, $inc: { "analytics.staffResponseCount": 1 } },
    );
  }

  static setPriority(channelId: string, priority: TicketPriority) {
    return TicketModel.updateOne({ channelId }, { priority, lastActivityAt: new Date() });
  }

  static setStatus(channelId: string, status: TicketStatus, extra?: Record<string, unknown>) {
    return TicketModel.updateOne({ channelId }, { $set: { status, lastActivityAt: new Date(), ...extra } });
  }

  static addNote(channelId: string, note: string) {
    return TicketModel.updateOne({ channelId }, { $push: { staffNotes: note.slice(0, 1000) } });
  }

  static guildStats(guildId: string) {
    return Promise.all([
      TicketModel.countDocuments({ guildId }),
      TicketModel.countDocuments({ guildId, status: { $in: ["open", "claimed", "locked"] } }),
      TicketModel.countDocuments({ guildId, status: "closed" }),
      TicketModel.countDocuments({ guildId, status: "archived" }),
    ]).then(([total, open, closed, archived]) => ({ total, open, closed, archived }));
  }

  static findInactive(guildId: string, olderThan: Date) {
    return TicketModel.find({
      guildId,
      status: { $in: ["open", "claimed"] },
      lastActivityAt: { $lt: olderThan },
    }).lean();
  }

  static findByGuild(guildId: string, statuses?: string[]) {
    const filter: Record<string, unknown> = { guildId };
    if (statuses?.length) filter.status = { $in: statuses };
    return TicketModel.find(filter).lean();
  }
}
