import type { ArkBotClient } from "../client/ArkBotClient.js";
import { processDueGiveaways } from "../workers/heavyJobProcessor.js";

/** Lightweight intervals (giveaway deadlines, etc.). */
export function startPeriodicTasks(client: ArkBotClient) {
  setInterval(() => {
    void processDueGiveaways(client).catch((err) => client.log.error({ err }, "Giveaway tick failed"));
  }, 60_000);
}
