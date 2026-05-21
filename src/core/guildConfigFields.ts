import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";

export type WelcomeConfig = Partial<NonNullable<GuildConfigurationDocument["welcome"]>>;
export type AutomodConfig = Partial<NonNullable<GuildConfigurationDocument["automod"]>>;
export type LoggingConfig = Partial<NonNullable<GuildConfigurationDocument["logging"]>>;
export type SecurityConfig = Partial<NonNullable<GuildConfigurationDocument["security"]>>;
export type SuggestionsConfig = Partial<NonNullable<GuildConfigurationDocument["suggestions"]>>;
export type TicketsConfig = Partial<NonNullable<GuildConfigurationDocument["tickets"]>>;
export type StatsConfig = Partial<NonNullable<GuildConfigurationDocument["stats"]>>;
export type EconomyConfig = Partial<NonNullable<GuildConfigurationDocument["economy"]>>;
export type BackupsConfig = Partial<NonNullable<GuildConfigurationDocument["backups"]>>;

export function readWelcome(cfg: GuildConfigurationDocument): WelcomeConfig {
  return (cfg.welcome ?? {}) as WelcomeConfig;
}

export function readAutomod(cfg: GuildConfigurationDocument): AutomodConfig {
  return (cfg.automod ?? {}) as AutomodConfig;
}

export function readLogging(cfg: GuildConfigurationDocument): LoggingConfig {
  return (cfg.logging ?? {}) as LoggingConfig;
}

export function readSecurity(cfg: GuildConfigurationDocument): SecurityConfig {
  return (cfg.security ?? {}) as SecurityConfig;
}

export function readSuggestions(cfg: GuildConfigurationDocument): SuggestionsConfig {
  return (cfg.suggestions ?? {}) as SuggestionsConfig;
}

export function readTickets(cfg: GuildConfigurationDocument): TicketsConfig {
  return (cfg.tickets ?? {}) as TicketsConfig;
}

export function readStats(cfg: GuildConfigurationDocument): StatsConfig {
  return (cfg.stats ?? {}) as StatsConfig;
}

export function readEconomy(cfg: GuildConfigurationDocument): EconomyConfig {
  return (cfg.economy ?? {}) as EconomyConfig;
}

export function readBackups(cfg: GuildConfigurationDocument): BackupsConfig {
  return (cfg.backups ?? {}) as BackupsConfig;
}

export function readCommandOnlyChannelIds(cfg: GuildConfigurationDocument) {
  return cfg.commandOnlyChannelIds ?? [];
}

export function readTicketCategoryMap(cfg: GuildConfigurationDocument): Record<string, string> {
  const raw = cfg.tickets?.categories as unknown;
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw.entries());
  if (typeof raw === "object") return raw as Record<string, string>;
  return {};
}
