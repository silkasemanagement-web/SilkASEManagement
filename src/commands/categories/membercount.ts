import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { readStats } from "../../core/guildConfigFields.js";
import { mergeStats } from "../../core/guildConfigPatch.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

export const membercountCategoryCommand = createCategoryConfigCommand({
  name: "membercount",
  description: "Member counter channel configuration.",
  meta: adminMeta,
  subcommands: [
    { name: "status", description: "Show member counter settings." },
    {
      name: "channel",
      description: "Set the primary member count channel.",
      configure: (sub) =>
        sub.addChannelOption((o) => o.setName("channel").setDescription("Counter channel").addChannelTypes(ChannelType.GuildVoice).setRequired(true)),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const stats = readStats(cfg);

    if (sub === "status") {
      const counters = stats.memberCounters?.length
        ? stats.memberCounters.map((c) => `**${c.type}** → <#${c.channelId}>`).join("\n")
        : "No counters configured.";
      return reply(
        interaction,
        neutral("Member count configs", counters, [
          { name: "Setup wizard", value: "Use `/membercount-setup` for advanced counter layouts.", inline: false },
        ]),
      );
    }

    const channel = interaction.options.getChannel("channel", true);
    await client.config.updateGuild(interaction.guild!.id, {
      stats: mergeStats(stats, {
        memberChannelId: channel.id,
        memberCounters: [{ channelId: channel.id, type: "members" }] as never,
      }),
    } as never);
    return reply(interaction, ok("Member counter saved", `Member counter channel: <#${channel.id}>.`));
  },
});
