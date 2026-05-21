import type { ChannelSelectMenuInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import {
  createMemberCounterChannel,
  MEMBER_COUNTER_LABELS,
  MEMBER_COUNTER_TYPES,
  refreshMemberCounters,
} from "../../services/MemberCountService.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export async function handleMemberCountCategory(client: ArkBotClient, interaction: ChannelSelectMenuInteraction) {
  if (!interaction.guild) return;
  await interaction.deferUpdate();
  const categoryId = interaction.values[0];
  const created: string[] = [];
  for (const type of MEMBER_COUNTER_TYPES) {
    const channel = await createMemberCounterChannel({
      client,
      guild: interaction.guild,
      categoryId,
      type,
    });
    if (channel) created.push(`${MEMBER_COUNTER_LABELS[type]}: <#${channel.id}>`);
  }
  await refreshMemberCounters(client, interaction.guild.id);
  await interaction.editReply({
    embeds: [
      DynamicEmbedBuilder.build({
        theme: "ark",
        title: "Member counters created",
        description: created.length ? created.join("\n") : "No counters were created. Check category permissions.",
      }),
    ],
    components: [],
  });
}
