import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { neutral, ok, reply } from "../../core/commandUi.js";
import { FeatureStoreService } from "../../services/FeatureStoreService.js";

const store = new FeatureStoreService();

export const starboardCategoryCommand = createCategoryConfigCommand({
  name: "starboard",
  description: "Starboard configuration.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show starboard settings." },
    {
      name: "channel",
      description: "Set starboard channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o.setName("channel").setDescription("Starboard channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        ),
    },
    {
      name: "threshold",
      description: "Set star threshold.",
      configure: (sub) => sub.addIntegerOption((o) => o.setName("stars").setDescription("Stars required").setRequired(true).setMinValue(1).setMaxValue(50)),
    },
  ],
  async execute(interaction, sub) {
    const guildId = interaction.guild!.id;
    const settings = (await store.get<{ channelId?: string; threshold?: number }>(guildId, "starboard", "settings")) ?? {};

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Starboard configs", "Starboard settings:", [
          { name: "Channel", value: settings.channelId ? `<#${settings.channelId}>` : "Not set", inline: true },
          { name: "Threshold", value: String(settings.threshold ?? 3), inline: true },
        ]),
      );
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      await store.set(guildId, "starboard", "settings", { ...settings, channelId: channel.id }, interaction.user.id);
      return reply(interaction, ok("Starboard channel saved", `Starboard: <#${channel.id}>.`));
    }

    const stars = interaction.options.getInteger("stars", true);
    await store.set(guildId, "starboard", "settings", { ...settings, threshold: stars }, interaction.user.id);
    return reply(interaction, ok("Threshold saved", `Starboard threshold: **${stars}** stars.`));
  },
});
