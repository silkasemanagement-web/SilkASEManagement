import { Schema, model, type InferSchemaType } from "mongoose";

const featureStoreSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    namespace: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    createdById: { type: String },
    updatedById: { type: String },
  },
  { timestamps: true },
);

featureStoreSchema.index({ guildId: 1, namespace: 1, key: 1 }, { unique: true });

export type FeatureStoreDocument = InferSchemaType<typeof featureStoreSchema> & { _id: string };
export const FeatureStoreModel = model("FeatureStore", featureStoreSchema);
