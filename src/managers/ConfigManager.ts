import { GuildConfigurationModel, type GuildConfigurationDocument } from "../models/GuildConfiguration.js";
import type { Env } from "../config/env.js";
import type { Logger } from "./LoggerManager.js";
import type { CacheManager } from "./CacheManager.js";
import { REDIS_PREFIX } from "../config/constants.js";

const TTL_SECONDS = 300;

export class ConfigManager {
  constructor(
    _env: Env,
    private readonly log: Logger,
    private readonly cache: CacheManager,
  ) {}

  private cacheKey(guildId: string) {
    return `${REDIS_PREFIX.cache}guildcfg:${guildId}`;
  }

  async getGuild(guildId: string): Promise<GuildConfigurationDocument> {
    const cached = await this.cache.getJson<GuildConfigurationDocument>(this.cacheKey(guildId));
    if (cached) return this.ensureDocumentShape(cached);

    let doc = await GuildConfigurationModel.findOne({ guildId }).lean();
    if (!doc) {
      await GuildConfigurationModel.create({ guildId });
      doc = await GuildConfigurationModel.findOne({ guildId }).lean();
    }
    if (!doc) {
      this.log.error({ guildId }, "Failed to bootstrap guild configuration");
      throw new Error("Guild configuration bootstrap failed");
    }
    const shaped = this.ensureDocumentShape(doc as unknown as GuildConfigurationDocument);
    await this.cache.setJson(this.cacheKey(guildId), shaped, TTL_SECONDS);
    return shaped;
  }

  async updateGuild(
    guildId: string,
    patch: Partial<GuildConfigurationDocument>,
  ): Promise<GuildConfigurationDocument> {
    const updated = await GuildConfigurationModel.findOneAndUpdate(
      { guildId },
      { $set: patch },
      { new: true, upsert: true },
    ).lean();
    await this.cache.del(this.cacheKey(guildId));
    return this.ensureDocumentShape(updated! as unknown as GuildConfigurationDocument);
  }

  invalidate(guildId: string) {
    return this.cache.del(this.cacheKey(guildId));
  }

  private ensureDocumentShape(doc: GuildConfigurationDocument): GuildConfigurationDocument {
    return doc;
  }
}
