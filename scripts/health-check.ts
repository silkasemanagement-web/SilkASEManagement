import "dotenv/config";
import mongoose from "mongoose";
import { Client, GatewayIntentBits } from "discord.js";
import { loadEnv } from "../src/config/env.js";

async function main() {
  const env = loadEnv();
  const issues: string[] = [];
  const ok: string[] = [];

  if (env.NODE_ENV === "production" && env.REDIS_URL === "memory://local") {
    issues.push("REDIS_URL=memory://local in production — use cloud Redis for 24/7 queues/transcripts.");
  } else if (env.REDIS_URL === "memory://local") {
    ok.push("Redis: in-memory (dev only — bot stops when this PC stops).");
  } else {
    ok.push("Redis: cloud URL configured.");
  }

  await mongoose.connect(env.MONGODB_URI);
  ok.push("MongoDB: connected.");
  await mongoose.disconnect();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(env.DISCORD_TOKEN);
  ok.push(`Discord: logged in as ${client.user?.tag ?? "unknown"}.`);

  const main = await client.guilds.fetch(env.MAIN_GUILD_ID).catch(() => null);
  if (main) ok.push(`Main guild: ${main.name} (${main.id})`);
  else issues.push(`Main guild ${env.MAIN_GUILD_ID} not visible — check bot invite & intents.`);

  client.destroy();

  console.log("\n=== Silk Manager health check ===\n");
  for (const line of ok) console.log(`  OK  ${line}`);
  for (const line of issues) console.log(`  !!  ${line}`);

  if (issues.length) {
    console.log("\nFix the issues above before relying on 24/7 uptime.\n");
    process.exit(1);
  }
  console.log("\nAll checks passed. For PC-off uptime, deploy to VPS/Railway (see HOSTING-24-7.md).\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
