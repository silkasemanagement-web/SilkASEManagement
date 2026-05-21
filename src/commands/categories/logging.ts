import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { mergeLogging } from "../../core/guildConfigPatch.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

const logTypes = [
  { name: "Message delete", value: "messageDelete" },
  { name: "Message edit", value: "messageEdit" },
  { name: "Member join", value: "memberJoin" },
  { name: "Member leave", value: "memberLeave" },
  { name: "Voice", value: "voice" },
  { name: "Role", value: "role" },
  { name: "Channel", value: "channel" },
  { name: "Nickname", value: "nickname" },
] as const;

const logKeyMap: Record<(typeof logTypes)[number]["value"], keyof NonNullable<import("../../models/GuildConfiguration.js").GuildConfigurationDocument["logging"]>> = {
  messageDelete: "messageDeleteChannelId",
  messageEdit: "messageEditChannelId",
  memberJoin: "memberJoinChannelId",
  memberLeave: "memberLeaveChannelId",
  voice: "voiceChannelId",
  role: "roleChannelId",
  channel: "channelChannelId",
  nickname: "nicknameChannelId",
};

export const loggingCategoryCommand = createCategoryConfigCommand({
  name: "logging",
  description: "Server logging channels.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show logging channel configuration." },
    {
      name: "setup",
      description: "Set a logging channel by type.",
      configure: (sub) =>
        sub
          .addStringOption((o) => o.setName("type").setDescription("Log type").setRequired(true).addChoices(...logTypes))
          .addChannelOption((o) =>
            o.setName("channel").setDescription("Log channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
          ),
    },
    {
      name: "audit",
      description: "Set audit mirror channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o.setName("channel").setDescription("Audit channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        ),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const logging = (cfg.logging ?? {}) as import("../../core/guildConfigFields.js").LoggingConfig;

    if (sub === "status") {
      const lines = logTypes.map((t) => {
        const key = logKeyMap[t.value];
        const id = logging[key];
        return `**${t.name}:** ${id ? `<#${id}>` : "Not set"}`;
      });
      lines.push(`**Audit mirror:** ${cfg.auditLogChannelId ? `<#${cfg.auditLogChannelId}>` : "Not set"}`);
      return reply(interaction, neutral("Logging configs", lines.join("\n")));
    }

    if (sub === "audit") {
      const channel = interaction.options.getChannel("channel", true);
      await client.config.updateGuild(interaction.guild!.id, { auditLogChannelId: channel.id } as never);
      return reply(interaction, ok("Audit log saved", `Audit mirror channel: <#${channel.id}>.`));
    }

    const type = interaction.options.getString("type", true) as keyof typeof logKeyMap;
    const channel = interaction.options.getChannel("channel", true);
    const key = logKeyMap[type];
    await client.config.updateGuild(interaction.guild!.id, {
      logging: mergeLogging(logging, { [key]: channel.id }),
    } as never);
    return reply(interaction, ok("Log channel saved", `Saved **${type}** logs to <#${channel.id}>.`));
  },
});
