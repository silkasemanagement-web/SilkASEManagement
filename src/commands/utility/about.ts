import { SlashCommandBuilder, version as discordJsVersion } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const aboutCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("about").setDescription("Show information about this bot."),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const client = interaction.client;
    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "About Silk Manager",
          description:
            "Silk Manager is a full Discord management bot for SILK ASE PS4/PS5 communities. It handles moderation, tickets, panels, security, automation, backups, templates, economy data, shop data, music command routing, giveaways, polls, embeds, reaction roles, member counters, AFK notices, translation, donations, and server utilities.",
          fields: [
            { name: "Bot", value: client.user?.tag ?? "Unknown", inline: true },
            { name: "Servers", value: String(client.guilds.cache.size), inline: true },
            { name: "Library", value: `discord.js ${discordJsVersion}`, inline: true },
            {
              name: "Core systems",
              value:
                "Config/settings panels, audit logs, moderation tools, jail, anti-nuke/security modules, tickets/panels, donations, automations, backups/templates, economy/shop, music routing, and utility commands.",
            },
            {
              name: "Command coverage",
              value:
                "The bot is deployed at Discord's 100 top-level command limit with grouped subcommands for larger systems. Use `/help` for the full up-to-date command panel.",
            },
          ],
        }),
      ],
    });
  },
};
