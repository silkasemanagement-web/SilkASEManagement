/** Stable ticket category keys stored in DB + config */
export const TICKET_CATEGORY_KEYS = [
  "discord_support",
  "news_support",
  "mesh_support",
  "mesh_foundation_support",
  "general_support",
  "purchase_support",
  "player_reports",
  "staff_help",
  "partnership",
  "appeals",
  "bug_report",
  "donation_support",
  "admin_help",
  "event_rewards",
  "giveaway_winner",
] as const;

export type TicketCategoryKey = (typeof TICKET_CATEGORY_KEYS)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategoryKey, string> = {
  discord_support: "Discord Support",
  news_support: "News Support",
  mesh_support: "Mesh Support",
  mesh_foundation_support: "Mesh Foundation Support",
  general_support: "General Support",
  purchase_support: "Purchase Support",
  player_reports: "Player Report",
  staff_help: "Staff Help",
  partnership: "Partnership",
  appeals: "Appeal",
  bug_report: "Bug Report",
  donation_support: "Donation Support",
  admin_help: "Admin Help",
  event_rewards: "Event Rewards",
  giveaway_winner: "Giveaway Winner",
};

export const TICKET_STATUSES = ["open", "claimed", "closed", "locked", "archived"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PANEL_IMAGE_ATTACHMENT = "ticket-panel-cover.png";

/** Default panel dropdown options (public support panel) */
export const TICKET_PANEL_OPTIONS: Array<{
  key: TicketCategoryKey;
  label: string;
  description: string;
  emojiName: string;
}> = [
  { key: "discord_support", label: "Discord Support", description: "Discord, server, or account help", emojiName: "Silk_Logo_d" },
  { key: "news_support", label: "News Support", description: "News and announcements", emojiName: "Astral_News" },
  { key: "mesh_support", label: "Mesh Support", description: "Mesh / teleporter support", emojiName: "Astral_Teleporter" },
  { key: "mesh_foundation_support", label: "Mesh Foundation", description: "Mesh foundation setup", emojiName: "Astral_Foundation" },
];

export const TICKET_PARENT_CATEGORY_IDS: Partial<Record<TicketCategoryKey, string>> = {
  discord_support: "1506860774201495582",
  news_support: "1506860814353830019",
  mesh_support: "1506860845127438416",
  mesh_foundation_support: "1506860884234866709",
};

export const TICKET_CUSTOM_IDS = {
  createSelect: "ae:ticket:create",
  claim: "ae:ticket:claim",
  close: "ae:ticket:close",
  lock: "ae:ticket:lock",
  unlock: "ae:ticket:unlock",
  transcript: "ae:ticket:transcript",
} as const;

export const MAX_CHANNELS_PER_CATEGORY = 50;
export const DEFAULT_MAX_OPEN_PER_USER = 3;
export const DEFAULT_AUTO_CLOSE_HOURS = 72;
export const DEFAULT_CREATE_COOLDOWN_MS = 60_000;
export const TRANSCRIPT_MESSAGE_LIMIT = 500;
