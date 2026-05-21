import {

  type ButtonInteraction,

  type ChannelSelectMenuInteraction,

  type Interaction,

  type ModalSubmitInteraction,

  type StringSelectMenuInteraction,

} from "discord.js";

import type { ArkBotClient } from "../client/ArkBotClient.js";

import { handleChatInputCommand } from "./slashCommandRunner.js";

import {

  handleEmbedButton,

  handleEmbedChannelSelect,

  handleEmbedModal,

} from "./interactions/embedInteractions.js";

import {

  handleConfigBooleanSelect,

  handleConfigButton,

  handleConfigChannelSelect,

  handleConfigRoleSelect,

  handleConfigSectionSelect,

  handleConfigSettingSelect,

  handleConfigTextModal,

} from "./interactions/configInteractions.js";


import { handleSuggestVote } from "./interactions/suggestionInteractions.js";

import { handleGiveawayEnter } from "./interactions/giveawayInteractions.js";

import { handlePollVote } from "./interactions/pollInteractions.js";

import { handleReactionRoleToggle } from "./interactions/reactionRoleInteractions.js";

import { handleMemberCountCategory } from "./interactions/memberCountInteractions.js";

import { isStaleOrAlreadyHandledInteraction, replyWithEmbed } from "../utils/interactionAck.js";

import { DynamicEmbedBuilder } from "../utils/embedBuilder.js";



const HANDLED_INTERACTION_TTL_MS = 15 * 60_000;

const handledInteractions = new Map<string, number>();



function markInteractionHandled(id: string) {

  const now = Date.now();

  for (const [interactionId, seenAt] of handledInteractions) {

    if (now - seenAt > HANDLED_INTERACTION_TTL_MS) handledInteractions.delete(interactionId);

  }



  if (handledInteractions.has(id)) return false;

  handledInteractions.set(id, now);

  return true;

}



export async function routeInteraction(client: ArkBotClient, interaction: Interaction) {

  if (!markInteractionHandled(interaction.id)) {

    client.log.warn({ interactionId: interaction.id, type: interaction.type }, "Duplicate interaction ignored");

    return;

  }



  try {
    if (interaction.isChatInputCommand()) {

      await handleChatInputCommand(client, interaction);

      return;

    }

    if (interaction.isModalSubmit()) {

      const modal = interaction as ModalSubmitInteraction;

      if (modal.customId.startsWith("ae:embed:")) {

        await handleEmbedModal(client, modal);

        return;

      }

      if (modal.customId.startsWith("ae:config:text:")) {

        await handleConfigTextModal(client, modal);

      }

      return;

    }

    if (interaction.isButton()) {

      const btn = interaction as ButtonInteraction;

      if (btn.customId.startsWith("ae:config:")) {

        await handleConfigButton(client, btn);

        return;

      }

      if (btn.customId.startsWith("ae:embed:")) {

        await handleEmbedButton(client, btn);

        return;

      }

      if (btn.customId.startsWith("ae:suggest:")) {

        await handleSuggestVote(client, btn);

        return;

      }

      if (btn.customId.startsWith("ae:gw:enter:")) {

        await handleGiveawayEnter(client, btn);

        return;

      }

      if (btn.customId.startsWith("ae:rr:toggle:")) {

        await handleReactionRoleToggle(client, btn);

        return;

      }

      if (btn.customId.startsWith("ae:ticket:")) {

        const { routeTicketInteraction } = await import("../tickets/interactions.js");

        await routeTicketInteraction(client, btn);

        return;

      }

      return;

    }

    if (interaction.isChannelSelectMenu()) {

      const sel = interaction as ChannelSelectMenuInteraction;

      if (sel.customId === "ae:embed:channel") {

        await handleEmbedChannelSelect(client, sel);

        return;

      }

      if (sel.customId === "ae:membercount:category") {

        await handleMemberCountCategory(client, sel);

        return;

      }

      if (sel.customId.startsWith("ae:config:channel:")) {

        await handleConfigChannelSelect(client, sel);

        return;

      }

      return;

    }

    if (interaction.isRoleSelectMenu()) {

      if (interaction.customId.startsWith("ae:config:roles:")) {

        await handleConfigRoleSelect(client, interaction);

        return;

      }

      return;

    }

    if (interaction.isStringSelectMenu()) {

      const sel = interaction as StringSelectMenuInteraction;

      if (sel.customId === "ae:config:section") {

        await handleConfigSectionSelect(client, sel);

        return;

      }

      if (sel.customId.startsWith("ae:config:setting:")) {

        await handleConfigSettingSelect(client, sel);

        return;

      }

      if (sel.customId.startsWith("ae:config:boolean:")) {

        await handleConfigBooleanSelect(client, sel);

        return;

      }

      if (sel.customId.startsWith("ae:poll:vote:")) {

        await handlePollVote(client, sel);

        return;

      }

    }

  } catch (err) {

    if (isStaleOrAlreadyHandledInteraction(err)) {

      client.log.warn({ err, type: interaction.type }, "Stale or already handled interaction ignored");

      return;

    }

    client.log.error({ err, type: interaction.type }, "Interaction routing failed");

    if (!interaction.isRepliable()) return;

    await replyWithEmbed(

      client,

      interaction,

      DynamicEmbedBuilder.build({

        theme: "alert",

        title: "Error",

        description: "Something went wrong. Please try again.",

      }),

    );

  }

}


