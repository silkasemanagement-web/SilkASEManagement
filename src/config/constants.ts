/** Default cooldown (ms) for slash commands when not overridden */
export const DEFAULT_COMMAND_COOLDOWN_MS = 2_000;

/** Redis key prefixes */
export const REDIS_PREFIX = {
  cache: "ae:cache:",
  cooldown: "ae:cooldown:",
  embedDraft: "ae:embedDraft:",
  automod: "ae:automod:",
  rateUser: "ae:rl:user:",
  rateChannel: "ae:rl:ch:",
} as const;

/** BullMQ queue names */
export const QUEUE_NAMES = {
  heavy: "heavy-tasks",
  transcripts: "transcripts",
  announcements: "announcements",
} as const;

/** Ticket constants — canonical source: src/tickets/constants.ts */
export {
  TICKET_CATEGORY_KEYS,
  TICKET_CATEGORY_LABELS,
  TICKET_PANEL_OPTIONS,
  TICKET_PARENT_CATEGORY_IDS,
  TICKET_PANEL_IMAGE_ATTACHMENT,
  type TicketCategoryKey,
} from "../tickets/constants.js";

/** Suggestion workflow */
export const SUGGESTION_STATUS = ["in_review", "approved", "denied", "implemented"] as const;

/** Custom scheduled bot events */
export const BOT_EVENT_TYPES = [
  "number_guess",
  "dino_scramble",
  "voice_last_leave",
  "custom",
] as const;

export type BotEventType = (typeof BOT_EVENT_TYPES)[number];
