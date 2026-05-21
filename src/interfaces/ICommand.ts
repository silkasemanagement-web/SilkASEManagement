import type {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";

export interface CommandMeta {
  /** Cooldown per user+guild in ms */
  cooldownMs?: number;
  /** Require one of these permission flags (bitfield names) */
  requiredDiscordPermissions?: bigint[];
  /** Require configured staff role in guild */
  requireStaff?: boolean;
  /** Require configured admin role */
  requireAdmin?: boolean;
  /** Only usable in managed guilds */
  guildOnly?: boolean;
  /** Defer the interaction before config/permission/cooldown checks for slow commands. */
  deferReply?: boolean;
  /** Whether the early deferred reply should be private. Defaults to true. */
  deferEphemeral?: boolean;
}

/** Builder chains may narrow to options-only builders; all expose `name` + `toJSON`. */
export type SlashCommandData = Pick<SlashCommandBuilder, "name" | "toJSON">;

export interface SlashCommand {
  data: SlashCommandData | (() => SlashCommandData);
  meta?: CommandMeta;
  execute(
    interaction:
      | ChatInputCommandInteraction
      | MessageContextMenuCommandInteraction
      | UserContextMenuCommandInteraction,
  ): Promise<void>;
}
