import type { BotEvent } from "../interfaces/IEvent.js";
import type { Interaction } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import { routeInteraction } from "../handlers/InteractionRouter.js";
import { routeTicketInteraction } from "../tickets/interactions.js";
import { auditInteractionCreate } from "./auditLogEvents.js";

export const interactionCreateEvent = {
  name: "interactionCreate" as const,
  async execute(interaction: Interaction) {
    const client = interaction.client as ArkBotClient;

    if (
      (interaction.isStringSelectMenu() || interaction.isButton()) &&
      (await routeTicketInteraction(client, interaction))
    ) {
      void auditInteractionCreate(interaction).catch((err) =>
        client.log.warn({ err, interactionId: interaction.id }, "Interaction audit log failed"),
      );
      return;
    }

    await routeInteraction(client, interaction);
    void auditInteractionCreate(interaction).catch((err) =>
      client.log.warn({ err, interactionId: interaction.id }, "Interaction audit log failed"),
    );
  },
} satisfies BotEvent;
