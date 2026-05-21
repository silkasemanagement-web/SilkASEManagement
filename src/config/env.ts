import { z } from "zod";

const snowflake = z
  .string()
  .regex(/^\d{17,22}$/, "Invalid Discord snowflake");

const optionalSnowflake = z.preprocess((v) => (v === "" ? undefined : v), snowflake.optional());
const optionalUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().url().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DISCORD_TOKEN: z
    .string()
    .min(1)
    .refine((s) => !s.includes("PASTE_"), "Replace DISCORD_TOKEN placeholder with a rotated bot token"),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_APPLICATION_ID: snowflake.optional(),
  MAIN_GUILD_ID: snowflake,
  DONATION_GUILD_ID: snowflake,
  DEV_GUILD_ID: optionalSnowflake,
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (s) => s.startsWith("mongodb://") || s.startsWith("mongodb+srv://"),
      "Must be a MongoDB connection string",
    )
    .refine((s) => !s.includes("PASTE_") && !s.includes("YOUR_"), "Replace MongoDB password placeholder"),
  REDIS_URL: z
    .string()
    .min(1)
    .refine((s) => !s.startsWith("redis-cli"), "Use only the Redis URL, not `redis-cli -u ...`")
    .refine(
      (s) => s.startsWith("redis://") || s.startsWith("rediss://") || s === "memory://local",
      "Must start with redis:// or rediss://, or use memory://local for development",
    )
    .refine((s) => !s.includes("PASTE_") && !s.includes("YOUR_"), "Replace Redis password placeholder"),
  USE_SHARDING: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  SHARD_COUNT: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === "auto") return "auto" as const;
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 1) return "auto" as const;
      return n;
    }),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DISCORD_ALERT_WEBHOOK_URL: optionalUrl,
  SILK_BANNER_URL: optionalUrl,
  SILK_ICON_URL: optionalUrl,
  LEGACY_WELCOME_CHANNEL_ID: optionalSnowflake,
  LEGACY_AUTO_ROLE_ID: optionalSnowflake,
  BOOST_THANK_YOU_CHANNEL_ID: optionalSnowflake,
  DEFAULT_COMMANDS_CHANNEL_ID: optionalSnowflake,
  SUGGESTION_COMMAND_CHANNEL_ID: optionalSnowflake,
  OPENAI_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .min(1)
      .optional()
      .refine((s) => !s || !s.includes("PASTE_"), "Replace OPENAI_API_KEY placeholder with your OpenAI key"),
  ),
  METRICS_PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined)),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  if (!cached.DISCORD_APPLICATION_ID) {
    cached = { ...cached, DISCORD_APPLICATION_ID: cached.DISCORD_CLIENT_ID };
  }
  return cached;
}

export function getManagedGuildIds(env: Env): string[] {
  return [env.MAIN_GUILD_ID, env.DONATION_GUILD_ID];
}

export function isManagedGuild(env: Env, guildId: string): boolean {
  return guildId === env.MAIN_GUILD_ID || guildId === env.DONATION_GUILD_ID;
}
