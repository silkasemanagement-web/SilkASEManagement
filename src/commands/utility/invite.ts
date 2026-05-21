import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const inviteCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("invite").setDescription("Get the bot invite link."),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const client = interaction.client as ArkBotClient;
    const clientId = client.env.DISCORD_APPLICATION_ID ?? client.env.DISCORD_CLIENT_ID;
    const permissions =
      PermissionFlagsBits.Administrator |
      PermissionFlagsBits.ManageGuild |
      PermissionFlagsBits.ManageRoles |
      PermissionFlagsBits.ManageChannels |
      PermissionFlagsBits.ModerateMembers;
    const inviteUrl =
      `https://discord.com/oauth2/authorize?client_id=${clientId}` +
      `&permissions=${permissions.toString()}` +
      "&integration_type=0&scope=bot+applications.commands";

    await interaction.reply({
      ephemeral: true,
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Invite Silk Manager",
          description: `[Click here to invite the bot to another Discord server](${inviteUrl}).`,
          fields: [
            {
              name: "Note",
              value: "You need permission to manage or add bots in the server you are inviting it to.",
            },
          ],
        }),
      ],
    });
  },
};
