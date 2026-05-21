import type { GuildTextBasedChannel } from "discord.js";
import type { CacheManager } from "../managers/CacheManager.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { ARK_DINOSAURS } from "../data/arkDinosaurs.js";

function scramble(word: string) {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.join("");
}

function scrambledPrompt(answer: string) {
  if (answer.length <= 1) return answer;
  let s = scramble(answer);
  let guard = 0;
  while (s === answer && guard++ < 8) s = scramble(answer);
  return s;
}

export class MiniGameHostService {
  constructor(private readonly cache: CacheManager) {}

  async hostNumberGuess(channel: GuildTextBasedChannel, ttlMinutes = 10): Promise<void> {
    const secret = Math.floor(Math.random() * 10_000) + 1;
    const key = `ae:event:number:${channel.id}`;
    await this.cache.setJson(
      key,
      { secret, endsAt: Date.now() + ttlMinutes * 60_000 },
      (ttlMinutes + 1) * 60,
    );
    await channel.send({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "ASE PS4/PS5 Guess the Number",
          description:
            "Type a number between **1** and **10,000** in this channel. The bot replies **higher** or **lower** (cooldown per survivor).\n" +
            `Event ends in **${ttlMinutes} minutes**.`,
        }),
      ],
    });
  }

  async hostDinoScramble(channel: GuildTextBasedChannel, ttlMinutes = 10): Promise<void> {
    const answer = ARK_DINOSAURS[Math.floor(Math.random() * ARK_DINOSAURS.length)]!;
    const scrambled = scrambledPrompt(answer);
    const key = `ae:event:dino:${channel.id}`;
    await this.cache.setJson(
      key,
      { answer: answer.toLowerCase(), endsAt: Date.now() + ttlMinutes * 60_000 },
      (ttlMinutes + 1) * 60,
    );
    await channel.send({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "ASE PS4/PS5 Dino Scramble",
          description: `Unscramble this ARK: Survival Evolved creature: **${scrambled}**\nReply in chat with your guess (${ttlMinutes} minutes).`,
        }),
      ],
    });
  }
}
