import { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import type { Logger } from "./LoggerManager.js";

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string | Buffer | number,
    mode?: string,
    ttl?: number,
    condition?: string,
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  ttl(key: string): Promise<number>;
  quit(): Promise<unknown>;
  on(event: string, cb: (...args: unknown[]) => void): unknown;
};

class MemoryRedis implements RedisLike {
  private readonly data = new Map<string, { value: string; expiresAt?: number }>();

  private read(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string): Promise<string | null> {
    return this.read(key);
  }

  async set(
    key: string,
    value: string | Buffer | number,
    mode?: string,
    ttl?: number,
    condition?: string,
  ): Promise<"OK" | null> {
    if (condition === "NX" && this.read(key) !== null) return null;
    const expiresAt = mode === "EX" && ttl ? Date.now() + ttl * 1000 : undefined;
    this.data.set(key, { value: String(value), expiresAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.data.delete(key)) removed++;
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const next = Number.parseInt(this.read(key) ?? "0", 10) + 1;
    this.data.set(key, { value: String(next), expiresAt: this.data.get(key)?.expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const current = this.read(key);
    if (current === null) return 0;
    this.data.set(key, { value: current, expiresAt: Date.now() + seconds * 1000 });
    return 1;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    const current = this.read(key);
    if (current === null) return 0;
    this.data.set(key, { value: current, expiresAt: Date.now() + ms });
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.data.get(key);
    if (!entry || this.read(key) === null) return -2;
    if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async quit(): Promise<"OK"> {
    this.data.clear();
    return "OK";
  }

  on(_event: string, _cb: (...args: unknown[]) => void): this {
    void _event;
    void _cb;
    return this;
  }
}

export class CacheManager {
  public readonly redis: RedisLike;
  public readonly isMemoryMode: boolean;

  constructor(
    _env: Env,
    private readonly log: Logger,
  ) {
    this.isMemoryMode = _env.REDIS_URL === "memory://local";
    if (this.isMemoryMode) {
      this.redis = new MemoryRedis();
      this.log.warn("Redis disabled: using in-memory development cache and no-op queues");
      return;
    }
    this.redis = new Redis(_env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    }) as unknown as RedisLike;
    this.redis.on("error", (err: unknown) => {
      this.log.error({ err }, "Redis connection error");
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const body = JSON.stringify(value);
    if (ttlSeconds) await this.redis.set(key, body, "EX", ttlSeconds);
    else await this.redis.set(key, body);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}
