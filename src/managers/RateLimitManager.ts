import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "./LoggerManager.js";
import type { CacheManager } from "./CacheManager.js";
import { REDIS_PREFIX } from "../config/constants.js";

/**
 * Lightweight outbound rate limiter for channel-scoped bot sends (debounced bulk operations).
 * Discord.js already queues REST; this protects application-level spam (loops, automations).
 */
export class RateLimitManager {
  constructor(
    private readonly cache: CacheManager,
    private readonly log: Logger,
  ) {}

  async consumeChannelToken(channelId: string, maxPerMinute = 20): Promise<void> {
    const key = `${REDIS_PREFIX.rateChannel}${channelId}`;
    const count = await this.cache.redis.incr(key);
    if (count === 1) await this.cache.redis.expire(key, 60);
    if (count > maxPerMinute) {
      this.log.warn({ channelId, count }, "Channel rate limit soft hit; delaying");
      await delay(1500);
    }
  }

  async consumeUserToken(userId: string, maxPerMinute = 30): Promise<void> {
    const key = `${REDIS_PREFIX.rateUser}${userId}`;
    const count = await this.cache.redis.incr(key);
    if (count === 1) await this.cache.redis.expire(key, 60);
    if (count > maxPerMinute) {
      await delay(2000);
    }
  }
}
