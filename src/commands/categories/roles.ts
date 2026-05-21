import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { readWelcome } from "../../core/guildConfigFields.js";
import { mergeWelcome } from "../../core/guildConfigPatch.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

export const rolesCategoryCommand = createCategoryConfigCommand({
  name: "roles",
  description: "Automatic and managed roles.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show role configuration." },
    {
      name: "auto-role",
      description: "Set the role granted when members join.",
      configure: (sub) => sub.addRoleOption((o) => o.setName("role").setDescription("Auto role").setRequired(true)),
    },
    { name: "clear-auto-role", description: "Remove join auto-role." },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const welcome = readWelcome(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Role configs", "Role settings:", [
          { name: "Join auto roles", value: welcome.autoRoleIds?.length ? welcome.autoRoleIds.map((id) => `<@&${id}>`).join(", ") : "Default / none", inline: false },
          { name: "Color roles", value: "Use `/color-role-create` to publish a color role menu.", inline: false },
          { name: "Reaction roles", value: "Use `/reaction-role-create` for reaction role panels.", inline: false },
        ]),
      );
    }

    if (sub === "clear-auto-role") {
      await client.config.updateGuild(interaction.guild!.id, {
        welcome: mergeWelcome(welcome, { autoRoleIds: [] }),
      } as never);
      return reply(interaction, ok("Auto role cleared", "Join auto-role was removed."));
    }

    const role = interaction.options.getRole("role", true);
    await client.config.updateGuild(interaction.guild!.id, {
      welcome: mergeWelcome(welcome, { autoRoleIds: [role.id] }),
    } as never);
    return reply(interaction, ok("Auto role saved", `${role} will be assigned on join.`));
  },
});
