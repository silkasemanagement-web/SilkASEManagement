import type { ClientEvents } from "discord.js";

export type EventKey = keyof ClientEvents;

/**
 * Distributive event registration type so each handler's `execute` tuple matches
 * `ClientEvents[name]` without widening to incompatible unions.
 */
export type BotEvent = {
  [K in EventKey]: {
    name: K;
    once?: boolean;
    execute: (...args: ClientEvents[K]) => Promise<void> | void;
  };
}[EventKey];
