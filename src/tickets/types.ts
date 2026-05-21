import type { TicketCategoryKey, TicketPriority, TicketStatus } from "./constants.js";

export type TicketResult<T = void> = { ok: true; data?: T } | { ok: false; message: string };

export type CreateTicketInput = {
  guildId: string;
  openerId: string;
  categoryKey: TicketCategoryKey;
  parentCategoryId: string;
  staffRoleIds: string[];
  openedVia?: "panel" | "slash" | "button" | "modal";
  panelName?: string;
};

export type TicketInfo = {
  id: string;
  ticketNumber: number;
  channelId: string;
  openerId: string;
  categoryKey: TicketCategoryKey;
  status: TicketStatus;
  priority: TicketPriority;
  claimedById?: string;
  locked: boolean;
  participants: string[];
  tags: string[];
  createdAt: Date;
};
