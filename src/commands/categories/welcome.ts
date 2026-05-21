import { ChannelType } from "discord.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { readWelcome } from "../../core/guildConfigFields.js";
import { mergeWelcome } from "../../core/guildConfigPatch.js";
import { boolLabel, neutral, ok, reply } from "../../core/commandUi.js";
import { buildDefaultWelcomeMessage } from "../../utils/welcomeMessage.js";

export const welcomeCategoryCommand = createCategoryConfigCommand({
  name: "welcome",
  description: "Member welcome system.",
  meta: adminMeta,
  subcommands: [
    {
      name: "setup",
      description: "Set welcome channel and message.",
      configure: (sub) =>
        sub
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Welcome channel")
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("message").setDescription("Message ({user}, {username}, {server}, {memberCount})").setMaxLength(2000),
          ),
    },
    {
      name: "disable",
      description: "Disable welcome messages.",
    },
    {
      name: "status",
      description: "Show welcome configuration.",
    },
    {
      name: "auto-roles",
      description: "Set roles granted on join.",
      configure: (sub) => sub.addRoleOption((o) => o.setName("role").setDescription("Auto role").setRequired(true)),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const welcome = readWelcome(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Welcome configs", `Welcome system: ${boolLabel(welcome.enabled !== false)}`, [
          { name: "Channel", value: welcome.joinChannelId ? `<#${welcome.joinChannelId}>` : "Not set", inline: true },
          { name: "Auto roles", value: welcome.autoRoleIds?.length ? welcome.autoRoleIds.map((id) => `<@&${id}>`).join(", ") : "Default", inline: true },
          { name: "Message", value: (welcome.joinEmbed?.description ?? "Default layout").slice(0, 300) },
        ]),
      );
    }

    if (sub === "disable") {
      await client.config.updateGuild(interaction.guild!.id, {
        welcome: mergeWelcome(welcome, { enabled: false }),
      } as never);
      return reply(interaction, ok("Welcome disabled", "New members will no longer receive welcome messages."));
    }

    if (sub === "auto-roles") {
      const role = interaction.options.getRole("role", true);
      await client.config.updateGuild(interaction.guild!.id, {
        welcome: mergeWelcome(welcome, { enabled: true, autoRoleIds: [role.id] }),
      } as never);
      return reply(interaction, ok("Auto role saved", `${role} will be assigned on join.`));
    }

    const channel = interaction.options.getChannel("channel", true);
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const message = interaction.options.getString("message") ?? buildDefaultWelcomeMessage(member);
    await client.config.updateGuild(interaction.guild!.id, {
      welcome: mergeWelcome(welcome, {
        enabled: true,
        joinChannelId: channel.id,
        joinEmbed: { title: welcome.joinEmbed?.title ?? "Welcome To SILK™ | 300+ POP", description: message },
      }),
    } as never);
    return reply(interaction, ok("Welcome configured", `New members will be welcomed in <#${channel.id}>.`));
  },
});
