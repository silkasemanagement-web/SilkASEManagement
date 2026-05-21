import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { readAutomod } from "../../core/guildConfigFields.js";
import { mergeAutomod } from "../../core/guildConfigPatch.js";
import { boolLabel, neutral, ok, reply } from "../../core/commandUi.js";

export const automodCategoryCommand = createCategoryConfigCommand({
  name: "automod",
  description: "Automatic moderation filters.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show automod settings." },
    { name: "enable", description: "Enable automod." },
    { name: "disable", description: "Disable automod." },
    {
      name: "spam",
      description: "Configure spam detection.",
      configure: (sub) =>
        sub
          .addIntegerOption((o) => o.setName("threshold").setDescription("Messages before action").setMinValue(2).setMaxValue(50))
          .addIntegerOption((o) => o.setName("interval").setDescription("Interval ms").setMinValue(1000).setMaxValue(60000)),
    },
    {
      name: "invites",
      description: "Toggle invite link blocking.",
      configure: (sub) =>
        sub.addStringOption((o) =>
          o
            .setName("mode")
            .setDescription("Enable or disable")
            .setRequired(true)
            .addChoices({ name: "Enable", value: "on" }, { name: "Disable", value: "off" }),
        ),
    },
    {
      name: "mentions",
      description: "Configure mass mention protection.",
      configure: (sub) =>
        sub.addIntegerOption((o) => o.setName("threshold").setDescription("Mention threshold").setRequired(true).setMinValue(2).setMaxValue(50)),
    },
    {
      name: "timeout",
      description: "Set automod timeout minutes.",
      configure: (sub) =>
        sub.addIntegerOption((o) => o.setName("minutes").setDescription("Timeout minutes").setRequired(true).setMinValue(1).setMaxValue(10080)),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const automod = readAutomod(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Automod configs", `Automod: ${boolLabel(automod.enabled)}`, [
          { name: "Anti spam", value: boolLabel(automod.antiSpam), inline: true },
          { name: "Anti invites", value: boolLabel(automod.antiInvites), inline: true },
          { name: "Anti raid", value: boolLabel(automod.antiRaid), inline: true },
          { name: "Mass mentions", value: boolLabel(automod.antiMassMention), inline: true },
          { name: "Spam threshold", value: String(automod.spamThreshold ?? 6), inline: true },
          { name: "Timeout", value: `${automod.autoTimeoutMinutes ?? 10} min`, inline: true },
        ]),
      );
    }

    if (sub === "enable") {
      await client.config.updateGuild(interaction.guild!.id, { automod: mergeAutomod(automod, { enabled: true }) } as never);
      return reply(interaction, ok("Automod enabled", "Automod is now active."));
    }

    if (sub === "disable") {
      await client.config.updateGuild(interaction.guild!.id, { automod: mergeAutomod(automod, { enabled: false }) } as never);
      return reply(interaction, ok("Automod disabled", "Automod is now off."));
    }

    if (sub === "spam") {
      const threshold = interaction.options.getInteger("threshold");
      const interval = interaction.options.getInteger("interval");
      await client.config.updateGuild(interaction.guild!.id, {
        automod: mergeAutomod(automod, {
          enabled: true,
          antiSpam: true,
          ...(threshold != null ? { spamThreshold: threshold } : {}),
          ...(interval != null ? { spamIntervalMs: interval } : {}),
        }),
      } as never);
      return reply(interaction, ok("Spam filter updated", "Spam detection settings were saved."));
    }

    if (sub === "invites") {
      const mode = interaction.options.getString("mode", true);
      await client.config.updateGuild(interaction.guild!.id, {
        automod: mergeAutomod(automod, { enabled: true, antiInvites: mode === "on" }),
      } as never);
      return reply(interaction, ok("Invite filter updated", `Invite blocking is **${mode === "on" ? "enabled" : "disabled"}**.`));
    }

    if (sub === "mentions") {
      const threshold = interaction.options.getInteger("threshold", true);
      await client.config.updateGuild(interaction.guild!.id, {
        automod: mergeAutomod(automod, { enabled: true, antiMassMention: true, massMentionThreshold: threshold }),
      } as never);
      return reply(interaction, ok("Mention filter updated", `Mass mention threshold set to **${threshold}**.`));
    }

    const minutes = interaction.options.getInteger("minutes", true);
    await client.config.updateGuild(interaction.guild!.id, {
      automod: mergeAutomod(automod, { autoTimeoutMinutes: minutes }),
    } as never);
    return reply(interaction, ok("Timeout updated", `Automod timeout set to **${minutes}** minutes.`));
  },
});
