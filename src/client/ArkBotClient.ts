import {
  Client,
  Collection,
  GatewayIntentBits,
  Options,
  Partials,
  type ClientOptions,
} from "discord.js";
import type { Env } from "../config/env.js";
import type { SlashCommand } from "../interfaces/ICommand.js";
import type { Logger } from "../managers/LoggerManager.js";
import type { CacheManager } from "../managers/CacheManager.js";
import type { QueueManager } from "../managers/QueueManager.js";
import type { ConfigManager } from "../managers/ConfigManager.js";
import type { RateLimitManager } from "../managers/RateLimitManager.js";

export class ArkBotClient extends Client {
  public readonly commands = new Collection<string, SlashCommand>();
  public readonly env: Env;
  public readonly log: Logger;
  public readonly cache: CacheManager;
  public readonly queues: QueueManager;
  public readonly config: ConfigManager;
  public readonly rateLimits: RateLimitManager;

  constructor(
    env: Env,
    log: Logger,
    cache: CacheManager,
    queues: QueueManager,
    config: ConfigManager,
    rateLimits: RateLimitManager,
    options?: Partial<ClientOptions>,
  ) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
      makeCache: Options.cacheWithLimits({
        MessageManager: { maxSize: 200 },
        ReactionManager: { maxSize: 200 },
      }),
      allowedMentions: { parse: ["users", "roles"], repliedUser: false },
      ...options,
    });
    this.env = env;
    this.log = log;
    this.cache = cache;
    this.queues = queues;
    this.config = config;
    this.rateLimits = rateLimits;
  }
}
