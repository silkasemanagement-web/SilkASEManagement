import mongoose from "mongoose";
import type { Env } from "../config/env.js";

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function attachMongoDebug(env: Env, log: { debug: (o: object) => void }): void {
  if (env.NODE_ENV === "development") {
    mongoose.set("debug", (collection, method, ...args: unknown[]) => {
      log.debug({ collection, method, args });
    });
  }
}
