import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";

type Welcome = NonNullable<GuildConfigurationDocument["welcome"]>;
type Automod = NonNullable<GuildConfigurationDocument["automod"]>;
type Logging = NonNullable<GuildConfigurationDocument["logging"]>;
type Security = NonNullable<GuildConfigurationDocument["security"]>;
type Suggestions = NonNullable<GuildConfigurationDocument["suggestions"]>;
type Tickets = NonNullable<GuildConfigurationDocument["tickets"]>;
type Stats = NonNullable<GuildConfigurationDocument["stats"]>;
type Economy = NonNullable<GuildConfigurationDocument["economy"]>;
type Backups = NonNullable<GuildConfigurationDocument["backups"]>;

export function mergeTickets(current: Partial<Tickets> | undefined, patch: Partial<Tickets>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeWelcome(current: Partial<Welcome> | undefined, patch: Partial<Welcome>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeAutomod(current: Partial<Automod> | undefined, patch: Partial<Automod>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeLogging(current: Partial<Logging> | undefined, patch: Partial<Logging>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeSecurity(current: Partial<Security> | undefined, patch: Partial<Security>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeSuggestions(current: Partial<Suggestions> | undefined, patch: Partial<Suggestions>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeStats(current: Partial<Stats> | undefined, patch: Partial<Stats>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeEconomy(current: Partial<Economy> | undefined, patch: Partial<Economy>) {
  return { ...(current ?? {}), ...patch };
}

export function mergeBackups(current: Partial<Backups> | undefined, patch: Partial<Backups>) {
  return { ...(current ?? {}), ...patch };
}
