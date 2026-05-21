import { FeatureStoreModel } from "../models/FeatureStore.js";

export class FeatureStoreService {
  async set(guildId: string, namespace: string, key: string, data: Record<string, unknown>, userId?: string) {
    return FeatureStoreModel.findOneAndUpdate(
      { guildId, namespace, key },
      {
        $set: {
          data,
          updatedById: userId,
        },
        $setOnInsert: { createdById: userId },
      },
      { upsert: true, new: true },
    ).lean();
  }

  async get<T extends Record<string, unknown>>(guildId: string, namespace: string, key: string) {
    const row = await FeatureStoreModel.findOne({ guildId, namespace, key }).lean();
    return (row?.data as T | undefined) ?? null;
  }

  async list<T extends Record<string, unknown>>(guildId: string, namespace: string) {
    const rows = await FeatureStoreModel.find({ guildId, namespace }).sort({ updatedAt: -1 }).lean();
    return rows.map((row) => ({ key: row.key, data: row.data as T, updatedAt: row.updatedAt }));
  }

  async delete(guildId: string, namespace: string, key: string) {
    return FeatureStoreModel.deleteOne({ guildId, namespace, key });
  }
}
