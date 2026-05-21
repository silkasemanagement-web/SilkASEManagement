import {
  MessageFlags,
  Routes,
  type Interaction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { DynamicEmbedBuilder } from "./embedBuilder.js";

function interactionErrorCode(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err
    ? (err as { code?: unknown }).code
    : undefined;
}

export function isStaleOrAlreadyHandledInteraction(err: unknown) {
  const code = interactionErrorCode(err);
  return code === 10062 || code === 40060 || code === "InteractionNotReplied";
}

export type TicketAckMode = "followUp" | "alreadyAcked";

/** Ephemeral follow-up via interaction webhook (works when this process did not defer locally). */
async function postInteractionWebhookFollowUp(
  client: ArkBotClient,
  interaction: Interaction,
  embedJson: ReturnType<ReturnType<typeof DynamicEmbedBuilder.build>["toJSON"]>,
) {
  if (!interaction.isRepliable()) return false;
  await client.rest.post(Routes.webhook(interaction.applicationId, interaction.token), {
    body: { embeds: [embedJson], flags: MessageFlags.Ephemeral },
  });
  return true;
}

async function patchWebhookOriginal(
  client: ArkBotClient,
  interaction: Interaction,
  embedJson: ReturnType<ReturnType<typeof DynamicEmbedBuilder.build>["toJSON"]>,
) {
  if (!interaction.isRepliable()) return false;
  await client.rest.patch(Routes.webhookMessage(interaction.applicationId, interaction.token, "@original"), {
    body: { embeds: [embedJson], flags: MessageFlags.Ephemeral },
  });
  return true;
}

/**
 * Message-component select menus must use deferUpdate (not deferReply).
 * If another consumer already acknowledged (40060), complete via interaction webhook follow-up.
 */
export async function acknowledgeTicketSelect(
  client: ArkBotClient,
  interaction: StringSelectMenuInteraction,
): Promise<TicketAckMode | false> {
  if (interaction.deferred || interaction.replied) {
    return interaction.deferred ? "followUp" : "alreadyAcked";
  }

  try {
    await interaction.deferUpdate();
    return "followUp";
  } catch (err) {
    const code = interactionErrorCode(err);
    if (code === 40060) {
      client.log.warn(
        { interactionId: interaction.id },
        "Ticket select already acknowledged — will use webhook follow-up",
      );
      return "alreadyAcked";
    }
    if (code === 10062) {
      client.log.error({ err, interactionId: interaction.id }, "Ticket select expired before acknowledge");
      return false;
    }
    throw err;
  }
}

export async function acknowledgeEphemeral(client: ArkBotClient, interaction: Interaction): Promise<boolean> {
  if (!interaction.isRepliable()) return false;
  if (interaction.deferred || interaction.replied) return true;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (err) {
    if (isStaleOrAlreadyHandledInteraction(err)) {
      client.log.warn(
        { err, interactionId: interaction.id, customId: "customId" in interaction ? interaction.customId : undefined },
        "Interaction acknowledge failed — token expired or already used",
      );
      return false;
    }
    client.log.error({ err, interactionId: interaction.id }, "Interaction acknowledge failed");
    throw err;
  }
}

export async function replyWithEmbed(
  client: ArkBotClient,
  interaction: Interaction,
  embed: ReturnType<typeof DynamicEmbedBuilder.build>,
  mode: boolean | TicketAckMode = false,
) {
  if (!interaction.isRepliable()) return false;

  const embedJson = embed.toJSON();
  const ephemeralReply: InteractionReplyOptions = { embeds: [embed], flags: MessageFlags.Ephemeral };
  const editPayload: InteractionEditReplyOptions = { embeds: [embed] };

  if (mode === "alreadyAcked") {
    try {
      await postInteractionWebhookFollowUp(client, interaction, embedJson);
      return true;
    } catch (err) {
      if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
      client.log.warn({ err, interactionId: interaction.id }, "Webhook follow-up failed, trying @original");
    }

    try {
      await patchWebhookOriginal(client, interaction, embedJson);
      return true;
    } catch (err) {
      if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
      client.log.warn({ err, interactionId: interaction.id }, "Webhook @original failed for alreadyAcked");
    }

    return false;
  }

  if (mode === "followUp") {
    try {
      await interaction.followUp(ephemeralReply);
      return true;
    } catch (err) {
      if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
      client.log.warn({ err, interactionId: interaction.id }, "followUp failed, trying webhook follow-up");
    }

    try {
      await postInteractionWebhookFollowUp(client, interaction, embedJson);
      return true;
    } catch (err) {
      if (!isStaleOrAlreadyHandledInteraction(err)) throw err;
      client.log.warn({ err, interactionId: interaction.id }, "Webhook follow-up failed after deferUpdate");
    }

    return false;
  }

  if (interaction.deferred || interaction.replied) {
    try {
      await interaction.editReply(editPayload);
      return true;
    } catch (err) {
      if (isStaleOrAlreadyHandledInteraction(err)) {
        client.log.warn({ err, interactionId: interaction.id }, "Could not edit deferred interaction reply");
        return false;
      }
      client.log.error({ err, interactionId: interaction.id }, "editReply failed");
      throw err;
    }
  }

  try {
    await interaction.reply(ephemeralReply);
    return true;
  } catch (err) {
    if (isStaleOrAlreadyHandledInteraction(err)) {
      client.log.warn({ err, interactionId: interaction.id }, "Could not reply to interaction");
      return false;
    }
    client.log.error({ err, interactionId: interaction.id }, "reply failed");
    throw err;
  }
}
