import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { boolLabel, neutral, ok, reply } from "../../core/commandUi.js";

export const moderationCategoryCommand = createCategoryConfigCommand({
  name: "moderation",
  description: "Moderation tools and settings.",
  meta: adminMeta,
  subcommands: [
    { name: "status", description: "Show moderation configuration." },
    {
      name: "permissions",
      description: "Set staff and admin roles.",
      configure: (sub) =>
        sub
          .addStringOption((o) =>
            o
              .setName("type")
              .setDescription("Role type")
              .setRequired(true)
              .addChoices({ name: "Staff", value: "staff" }, { name: "Admin", value: "admin" }, { name: "Helper", value: "helper" }),
          )
          .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)),
    },
    {
      name: "logs",
      description: "Set moderation log channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o.setName("channel").setDescription("Mod log channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        ),
    },
    {
      name: "punishments",
      description: "Set default automod timeout minutes.",
      configure: (sub) =>
        sub.addIntegerOption((o) => o.setName("minutes").setDescription("Timeout minutes").setRequired(true).setMinValue(1).setMaxValue(10080)),
    },
    { name: "automod", description: "Open automod summary (use /automod configs)." },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Moderation configs", "Current moderation settings:", [
          { name: "Staff roles", value: cfg.staffRoleIds?.length ? cfg.staffRoleIds.map((id) => `<@&${id}>`).join(", ") : "None", inline: false },
          { name: "Admin roles", value: cfg.adminRoleIds?.length ? cfg.adminRoleIds.map((id) => `<@&${id}>`).join(", ") : "None", inline: false },
          { name: "Mod log", value: cfg.modLogChannelId ? `<#${cfg.modLogChannelId}>` : "Not set", inline: true },
          { name: "Automod", value: boolLabel(cfg.automod?.enabled), inline: true },
        ]),
      );
    }

    if (sub === "permissions") {
      const type = interaction.options.getString("type", true);
      const role = interaction.options.getRole("role", true);
      const patch =
        type === "admin"
          ? { adminRoleIds: [role.id] }
          : type === "helper"
            ? { helperRoleIds: [role.id] }
            : { staffRoleIds: [role.id] };
      await client.config.updateGuild(interaction.guild!.id, patch as never);
      return reply(interaction, ok("Role saved", `${type} role set to ${role}.`));
    }

    if (sub === "logs") {
      const channel = interaction.options.getChannel("channel", true);
      await client.config.updateGuild(interaction.guild!.id, { modLogChannelId: channel.id } as never);
      return reply(interaction, ok("Mod log saved", `Moderation logs will post in <#${channel.id}>.`));
    }

    if (sub === "punishments") {
      const minutes = interaction.options.getInteger("minutes", true);
      await client.config.updateGuild(interaction.guild!.id, {
        automod: { ...(cfg.automod ?? {}), autoTimeoutMinutes: minutes },
      } as never);
      return reply(interaction, ok("Punishment timeout saved", `Default timeout set to **${minutes}** minutes.`));
    }

    return reply(
      interaction,
      neutral("Automod", `Automod is ${boolLabel(cfg.automod?.enabled)}. Use \`/automod configs\` for full automod settings.`),
    );
  },
});
