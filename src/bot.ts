import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { connectDatabase, attachMongoDebug } from "./database/connection.js";
import { createLogger } from "./managers/LoggerManager.js";
import { CacheManager } from "./managers/CacheManager.js";
import { QueueManager, createHeavyWorker } from "./managers/QueueManager.js";
import { ConfigManager } from "./managers/ConfigManager.js";
import { RateLimitManager } from "./managers/RateLimitManager.js";
import { ArkBotClient } from "./client/ArkBotClient.js";
import { registerSlashCommands } from "./handlers/CommandHandler.js";
import { registerEvents } from "./handlers/EventHandler.js";
import { processHeavyJob } from "./workers/heavyJobProcessor.js";
import { allCommands } from "./commands/registry.js";
import { readyEvent } from "./events/ready.js";
import { interactionCreateEvent } from "./events/interactionCreate.js";
import { guildMemberAddEvent } from "./events/guildMemberAdd.js";
import { guildMemberRemoveEvent } from "./events/guildMemberRemove.js";
import { guildBanAddEvent } from "./events/guildBanAdd.js";
import { guildBanRemoveEvent } from "./events/guildBanRemove.js";
import { voiceStateUpdateEvent } from "./events/voiceStateUpdate.js";
import { channelCreateEvent } from "./events/channelCreate.js";
import { guildMemberUpdateEvent } from "./events/guildMemberUpdate.js";
import { messageCreateEvent } from "./events/messageCreate.js";
import { auditLogEvents } from "./events/auditLogEvents.js";
import { AuditLogService } from "./services/AuditLogService.js";

async function bootstrap() {
  const env = loadEnv();
  const log = createLogger(env);
  await connectDatabase(env.MONGODB_URI);
  if (env.LOG_LEVEL === "debug") attachMongoDebug(env, log);
  const cache = new CacheManager(env, log);
  const queues = new QueueManager(env, log, cache);
  const config = new ConfigManager(env, log, cache);
  const rateLimits = new RateLimitManager(cache, log);
  const client = new ArkBotClient(env, log, cache, queues, config, rateLimits);

  createHeavyWorker(cache, log, (name, data) => processHeavyJob(client, name, data));

  await registerSlashCommands(client, allCommands);
  await registerEvents(client, [
    interactionCreateEvent,
    readyEvent,
    guildMemberAddEvent,
    guildMemberRemoveEvent,
    guildBanAddEvent,
    guildBanRemoveEvent,
    voiceStateUpdateEvent,
    channelCreateEvent,
    guildMemberUpdateEvent,
    messageCreateEvent,
    ...auditLogEvents,
  ]);

  process.on("unhandledRejection", (reason) => {
    log.error({ reason }, "unhandledRejection");
    void AuditLogService.internal(client, "Unhandled promise rejection", { reason });
  });
  process.on("uncaughtException", (err) => {
    log.error({ err }, "uncaughtException");
    void AuditLogService.internal(client, "Uncaught exception", { error: `${err.name}: ${err.message}`, stack: err.stack });
  });
  process.on("SIGINT", () => {
    void AuditLogService.internal(client, "Bot shutdown signal", { signal: "SIGINT" });
  });
  process.on("SIGTERM", () => {
    void AuditLogService.internal(client, "Bot shutdown signal", { signal: "SIGTERM" });
  });

  await client.login(env.DISCORD_TOKEN);
  void AuditLogService.internal(client, "Bot login completed", { tag: client.user?.tag ?? "unknown" });
  if (cache.isMemoryMode) {
    void AuditLogService.internal(client, "Queue/cache fallback active", {
      redis: "disabled",
      queues: "no-op",
      reason: "REDIS_URL=memory://local",
    });
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
