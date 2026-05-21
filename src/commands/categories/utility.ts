import { ChannelType, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { publicMeta } from "../../core/commandMeta.js";
import { readCommandOnlyChannelIds } from "../../core/guildConfigFields.js";
import { alert, neutral, ok, reply } from "../../core/commandUi.js";
import { isStaff } from "../../utils/discord.js";

async function requireManageGuild(interaction: ChatInputCommandInteraction, client: ArkBotClient) {
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const cfg = await client.config.getGuild(interaction.guild!.id);
  if (member.permissions.has(PermissionFlagsBits.ManageGuild) || isStaff(member, cfg)) return true;
  await reply(interaction, alert("Permission denied", "You need **Manage Server** or a staff role to change this setting."));
  return false;
}

export const utilityCategoryCommand = createCategoryConfigCommand({
  name: "utility",
  description: "Utility commands and command-only channels.",
  meta: { ...publicMeta, deferEphemeral: true },
  subcommands: [
    { name: "status", description: "List utility commands and command-only channels." },
    {
      name: "set-command-channel",
      description: "Mark a channel as commands-only (no normal chat).",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Commands-only channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    },
    {
      name: "remove-command-channel",
      description: "Remove commands-only mode from a channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to remove")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    },
    { name: "list-command-channels", description: "List all commands-only channels." },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const channels = readCommandOnlyChannelIds(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral(
          "Utility",
          "Member commands: `/about`, `/help`, `/server`, `/user`, `/avatar`, `/banner`, `/afk`, `/translate`, `/invite`, `/coin-flip`, `/rock-paper-scissors`, `/role-info`, `/wallet`, `/animal`, `/ticket create`, `/suggest` (in the suggestions command channel).",
          [
            {
              name: "Commands-only channels",
              value: channels.length ? channels.map((id) => `<#${id}>`).join(", ") : "None configured",
            },
          ],
        ),
      );
    }

    if (!(await requireManageGuild(interaction, client))) return;

    if (sub === "list-command-channels") {
      return reply(
        interaction,
        neutral("Commands-only channels", channels.length ? channels.map((id) => `<#${id}>`).join("\n") : "No channels configured."),
      );
    }

    const channel = interaction.options.getChannel("channel", true);
    if (sub === "set-command-channel") {
      if (channels.includes(channel.id)) {
        return reply(interaction, alert("Commands channel", `<#${channel.id}> is already commands-only.`));
      }
      await client.config.updateGuild(interaction.guild!.id, {
        commandOnlyChannelIds: [...channels, channel.id],
      } as never);
      return reply(
        interaction,
        ok("Commands-only enabled", `<#${channel.id}> is now **commands only**. Normal messages will be removed. Use slash commands here.`),
      );
    }

    await client.config.updateGuild(interaction.guild!.id, {
      commandOnlyChannelIds: channels.filter((id) => id !== channel.id),
    } as never);
    return reply(interaction, ok("Commands-only removed", `<#${channel.id}> allows normal chat again.`));
  },
});
