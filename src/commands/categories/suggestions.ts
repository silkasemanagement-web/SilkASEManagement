import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { readSuggestions } from "../../core/guildConfigFields.js";
import { mergeSuggestions } from "../../core/guildConfigPatch.js";
import { boolLabel, neutral, ok, reply } from "../../core/commandUi.js";

export const suggestionsCategoryCommand = createCategoryConfigCommand({
  name: "suggestions",
  description: "Suggestion system configuration.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show suggestion settings." },
    {
      name: "channel",
      description: "Set suggestions channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o.setName("channel").setDescription("Suggestions channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        ),
    },
    {
      name: "anonymous",
      description: "Allow anonymous suggestions.",
      configure: (sub) =>
        sub.addStringOption((o) =>
          o.setName("mode").setDescription("Enable or disable").setRequired(true).addChoices({ name: "Enable", value: "on" }, { name: "Disable", value: "off" }),
        ),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const suggestions = readSuggestions(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Suggestion configs", "Suggestion settings:", [
          { name: "Channel", value: suggestions.channelId ? `<#${suggestions.channelId}>` : "Not set", inline: true },
          { name: "Anonymous", value: boolLabel(suggestions.anonymousAllowed), inline: true },
          { name: "Usage", value: "Members use `/suggest` to post suggestions.", inline: false },
        ]),
      );
    }

    if (sub === "anonymous") {
      const mode = interaction.options.getString("mode", true);
      await client.config.updateGuild(interaction.guild!.id, {
        suggestions: mergeSuggestions(suggestions, { anonymousAllowed: mode === "on" }),
      } as never);
      return reply(interaction, ok("Anonymous setting saved", `Anonymous suggestions: **${mode === "on" ? "on" : "off"}**.`));
    }

    const channel = interaction.options.getChannel("channel", true);
    await client.config.updateGuild(interaction.guild!.id, {
      suggestions: mergeSuggestions(suggestions, { channelId: channel.id }),
    } as never);
    return reply(interaction, ok("Suggestions channel saved", `Suggestions will post in <#${channel.id}>.`));
  },
});
