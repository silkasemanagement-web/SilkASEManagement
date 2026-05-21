import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { BotEvent } from "../interfaces/IEvent.js";

/**
 * Discord.js listener typing widens `events` to a huge union; use a thin runtime
 * wrapper so registration stays fast to compile while each event still `satisfies BotEvent`.
 */
export async function registerEvents(client: ArkBotClient, events: BotEvent[]) {
  const seen = new Set<BotEvent>();
  const ordered = [
    ...events.filter((ev) => ev.name === "interactionCreate"),
    ...events.filter((ev) => ev.name !== "interactionCreate"),
  ];

  for (const ev of ordered) {
    if (seen.has(ev)) {
      throw new Error(`Duplicate event listener registered: ${String(ev.name)}`);
    }
    seen.add(ev);
    const listener = async (...args: unknown[]) => {
      await (ev.execute as (...a: unknown[]) => Promise<void>)(...args);
    };
    if (ev.once) client.once(ev.name, listener as never);
    else client.on(ev.name, listener as never);
  }
}
