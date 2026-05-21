import { REDIS_PREFIX } from "../config/constants.js";
import type { CacheManager } from "../managers/CacheManager.js";

export async function enforceSlashCooldown(params: {
  cache: CacheManager;
  userId: string;
  guildId: string;
  commandName: string;
  cooldownMs: number;
}): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const key = `${REDIS_PREFIX.cooldown}${params.guildId}:${params.userId}:${params.commandName}`;
  const ttlSeconds = Math.max(1, Math.ceil(params.cooldownMs / 1000));
  const res = await params.cache.redis.set(key, "1", "EX", ttlSeconds, "NX");
  if (res === "OK") return { ok: true };
  const ttl = await params.cache.redis.ttl(key);
  return { ok: false, retryAfterMs: Math.max(250, ttl * 1000) };
}
