import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ShardingManager } from "discord.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./managers/LoggerManager.js";

const env = loadEnv();
const log = createLogger(env);
const dir = path.dirname(fileURLToPath(import.meta.url));
const manager = new ShardingManager(path.join(dir, "bot.js"), {
  token: env.DISCORD_TOKEN,
  totalShards: env.SHARD_COUNT === "auto" ? "auto" : env.SHARD_COUNT,
});

manager.on("shardCreate", (shard) => log.info({ id: shard.id }, "Launched shard"));

await manager.spawn({ timeout: 120_000 }).catch((err) => {
  log.error({ err }, "Sharding manager failed to spawn");
  process.exit(1);
});
