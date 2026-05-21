import { Queue, Worker, type JobsOptions } from "bullmq";
import type { Env } from "../config/env.js";
import { QUEUE_NAMES } from "../config/constants.js";
import type { Logger } from "./LoggerManager.js";
import type { CacheManager } from "./CacheManager.js";

export type HeavyJobName = "export_ticket_transcript" | "broadcast_embed" | "purge_audit_export" | "mass_role_apply";

export interface HeavyJobPayloads {
  export_ticket_transcript: {
    ticketId: string;
    channelId: string;
    guildId: string;
    closedById: string;
  };
  broadcast_embed: { guildId: string; channelIds: string[]; payload: unknown };
  purge_audit_export: { guildId: string; moderatorId: string };
  mass_role_apply: { guildId: string; roleId: string; action: "add" | "remove"; moderatorId: string };
}

export class QueueManager {
  public readonly heavyQueue: Queue | null;

  constructor(
    _env: Env,
    private readonly log: Logger,
    cache: CacheManager,
  ) {
    if (cache.isMemoryMode) {
      this.heavyQueue = null;
      this.log.warn("BullMQ disabled: REDIS_URL=memory://local");
      return;
    }
    const connection = cache.redis as never;
    this.heavyQueue = new Queue(QUEUE_NAMES.heavy, { connection });
    this.heavyQueue.on("error", (err) => this.log.error({ err }, "BullMQ queue error"));
  }

  async enqueue<K extends HeavyJobName>(name: K, data: HeavyJobPayloads[K], opts?: JobsOptions) {
    if (!this.heavyQueue) {
      this.log.warn({ name, data, opts }, "Queue job skipped because BullMQ is disabled");
      return;
    }
    await this.heavyQueue.add(name, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
      ...opts,
    });
  }

  async shutdown(): Promise<void> {
    await this.heavyQueue?.close();
  }
}

export function createHeavyWorker(
  cache: CacheManager,
  log: Logger,
  processor: (name: string, data: unknown) => Promise<void>,
): Worker | null {
  if (cache.isMemoryMode) {
    log.warn("Heavy worker disabled: REDIS_URL=memory://local");
    return null;
  }
  return new Worker(
    QUEUE_NAMES.heavy,
    async (job) => {
      await processor(job.name, job.data);
    },
    { connection: cache.redis as never, concurrency: 2 },
  ).on("failed", (job, err) => {
    log.error({ err, jobId: job?.id, name: job?.name }, "Heavy job failed");
  });
}
