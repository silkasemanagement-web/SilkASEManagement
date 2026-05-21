import type { VoiceState } from "discord.js";
import type { BotEvent } from "../interfaces/IEvent.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { scheduleMemberCounterRefresh } from "../services/MemberCountService.js";

export const voiceStateUpdateEvent = {
  name: "voiceStateUpdate" as const,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild ?? oldState.guild;
    const client = newState.client as ArkBotClient;
    if (!isManagedGuild(client.env, guild.id)) return;
    if (oldState.channelId !== newState.channelId) {
      scheduleMemberCounterRefresh(client, guild.id);
    }
  },
} satisfies BotEvent;
