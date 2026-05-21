import type { Message } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { REDIS_PREFIX } from "../config/constants.js";

const URL_RE = /(https?:\/\/[^\s]+)/gi;
const SCAM_HINTS = ["nitro", "steamcommunity", "gift", "discord.gg/", "free-nitro"];

export class AutomodService {
  async evaluateMessage(client: ArkBotClient, message: Message) {
    const cfg = await client.config.getGuild(message.guild!.id);
    if (!cfg.automod?.enabled) return;
    const content = message.content.toLowerCase();
    if (cfg.automod.antiInvites && /discord\.gg\/[a-z0-9]+/i.test(content)) {
      await this.timeoutUser(client, message, "Posted invite link");
      return;
    }
    if (cfg.automod.antiScamLinks) {
      if (SCAM_HINTS.some((h) => content.includes(h))) {
        await this.timeoutUser(client, message, "Potential scam keyword");
        return;
      }
      const urls = message.content.match(URL_RE) ?? [];
      for (const u of urls) {
        if (SCAM_HINTS.some((h) => u.toLowerCase().includes(h))) {
          await this.timeoutUser(client, message, "Potential scam link");
          return;
        }
      }
    }
    if (cfg.automod.antiMassMention) {
      let mentions = message.mentions.users.size + message.mentions.roles.size;
      if (message.mentions.everyone) mentions += 25;
      if (mentions >= (cfg.automod.massMentionThreshold ?? 5)) {
        await this.timeoutUser(client, message, "Mass mention");
        return;
      }
    }
    if (cfg.automod.antiSpam) {
      const bucketKey = `${REDIS_PREFIX.automod}spam:${message.guild!.id}:${message.author.id}`;
      const hits = await client.cache.redis.incr(bucketKey);
      if (hits === 1) await client.cache.redis.pexpire(bucketKey, cfg.automod.spamIntervalMs ?? 7000);
      if (hits >= (cfg.automod.spamThreshold ?? 6)) {
        await this.timeoutUser(client, message, "Spam detection");
        await client.cache.redis.del(bucketKey);
      }
    }
  }

  private async timeoutUser(client: ArkBotClient, message: Message, reason: string) {
    const minutes = (await client.config.getGuild(message.guild!.id)).automod?.autoTimeoutMinutes ?? 10;
    const member = await message.guild!.members.fetch(message.author.id).catch(() => null);
    if (!member?.moderatable) return;
    await member.timeout(minutes * 60_000, reason).catch(() => null);
    await message.delete().catch(() => null);
  }
}
