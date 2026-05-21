import type { ChatInputCommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { isManagedGuild } from "../config/env.js";
import { DEFAULT_COMMAND_COOLDOWN_MS } from "../config/constants.js";
import { enforceSlashCooldown } from "../middleware/cooldown.js";
import { assertCommandPermissions } from "../middleware/permissions.js";
import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";
import { AuditLogService } from "../services/AuditLogService.js";

function interactionErrorCode(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err
    ? (err as { code?: unknown }).code
    : undefined;
}

function isStaleOrAlreadyHandledInteraction(err: unknown) {
  const code = interactionErrorCode(err);
  return code === 10062 || code === 40060 || code === "InteractionNotReplied";
}

async function sendCommandResponse(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
) {
  if (interaction.deferred) {
    const editPayload = { ...payload } as Record<string, unknown>;
    delete editPayload.ephemeral;
    delete editPayload.flags;
    await interaction.editReply(editPayload as InteractionEditReplyOptions).catch((err) => {
      if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
    });
    return;
  }
  if (interaction.replied) {
    const client = interaction.client as ArkBotClient;
    client.log.warn({ command: interaction.commandName }, "Skipped extra command response because interaction already replied");
    return;
  }
  await interaction.reply(payload).catch((err) => {
    if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
  });
}

async function ensureDeferred(interaction: ChatInputCommandInteraction, ephemeral: boolean) {
  if (interaction.deferred || interaction.replied) return true;
  return interaction.deferReply({ ephemeral }).then(
    () => true,
    (err) => {
      if (isStaleOrAlreadyHandledInteraction(err)) return false;
      throw err;
    },
  );
}

export async function handleChatInputCommand(client: ArkBotClient, interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) return;
  if (!isManagedGuild(client.env, interaction.guild.id)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "Unauthorized guild",
          description: "This bot only operates on configured SILK™ ASE PlayStation servers.",
        }),
      ],
    });
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const cfgPromise = client.config.getGuild(interaction.guild.id);
  const shouldAutoDefer = command.meta?.deferReply !== false;

  if (shouldAutoDefer) {
    const deferEphemeral = command.meta?.deferEphemeral ?? true;
    const deferred = await ensureDeferred(interaction, deferEphemeral);
    if (!deferred) {
      client.log.warn({ command: interaction.commandName }, "Interaction was stale before defer");
      return;
    }
  }

  void AuditLogService.log(client, {
    guild: interaction.guild,
    title: "Command received",
    description: `${interaction.user.tag} used /${interaction.commandName}.`,
    fields: [
      { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: "Channel", value: interaction.channelId ? `<#${interaction.channelId}> (${interaction.channelId})` : "Unknown", inline: true },
      { name: "Interaction ID", value: interaction.id, inline: true },
    ],
    sourceChannelId: interaction.channelId,
    sourceUserId: interaction.user.id,
  });

  const cfg = await cfgPromise;
  const perm = await assertCommandPermissions({
    interaction,
    meta: command.meta,
    cfg,
  });
  if (!perm.ok) {
    await sendCommandResponse(interaction, {
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "Permission denied",
          description: perm.message,
        }),
      ],
    });
    return;
  }

  const cdMs = command.meta?.cooldownMs ?? DEFAULT_COMMAND_COOLDOWN_MS;
  const cd = await enforceSlashCooldown({
    cache: client.cache,
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    commandName: interaction.commandName,
    cooldownMs: cdMs,
  });
  if (!cd.ok) {
    await sendCommandResponse(interaction, {
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Cooldown",
          description: `Please wait **${Math.ceil(cd.retryAfterMs / 1000)}s** before reusing this command.`,
        }),
      ],
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    if (isStaleOrAlreadyHandledInteraction(err)) {
      client.log.warn({ err, command: interaction.commandName }, "Command interaction was stale or already handled");
      return;
    }
    client.log.error({ err, command: interaction.commandName }, "Command execution failed");
    void AuditLogService.log(client, {
      guild: interaction.guild,
      title: "Command execution failed",
      description: `/${interaction.commandName} failed.`,
      fields: [
        { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
        { name: "Error", value: err instanceof Error ? `${err.name}: ${err.message}` : String(err) },
      ],
      sourceChannelId: interaction.channelId,
      sourceUserId: interaction.user.id,
      force: true,
    });
    const payload = {
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "Command error",
          description: "An unexpected error occurred. Staff have been notified in logs.",
        }),
      ],
    };
    await sendCommandResponse(interaction, payload);
  }
}
