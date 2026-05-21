import type { ButtonInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export async function handleReactionRoleToggle(_client: ArkBotClient, interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.member || !("roles" in interaction.member)) return;
  const roleId = interaction.customId.split(":").pop();
  if (!roleId) return;
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({ ephemeral: true, content: "Role missing." });
    return;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(role, "reaction-role panel");
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Role removed",
          description: `Removed ${role}`,
        }),
      ],
    });
  } else {
    await member.roles.add(role, "reaction-role panel");
    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Role granted",
          description: `Added ${role}`,
        }),
      ],
    });
  }
}
