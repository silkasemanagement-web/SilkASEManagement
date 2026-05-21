import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { readAutomod, readSecurity } from "../../core/guildConfigFields.js";
import { mergeAutomod, mergeSecurity } from "../../core/guildConfigPatch.js";
import { boolLabel, neutral, ok, reply } from "../../core/commandUi.js";

export const securityCategoryCommand = createCategoryConfigCommand({
  name: "security",
  description: "Server security and protection.",
  meta: adminMeta,
  subcommands: [
    { name: "status", description: "Show security settings." },
    { name: "anti-raid", description: "Enable anti-raid protection." },
    { name: "anti-raid-off", description: "Disable anti-raid protection." },
    { name: "anti-nuke", description: "Enable anti-nuke protection." },
    { name: "anti-nuke-off", description: "Disable anti-nuke protection." },
    {
      name: "verification",
      description: "Toggle verification requirement.",
      configure: (sub) =>
        sub.addStringOption((o) =>
          o
            .setName("mode")
            .setDescription("Enable or disable")
            .setRequired(true)
            .addChoices({ name: "Enable", value: "on" }, { name: "Disable", value: "off" }),
        ),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const security = readSecurity(cfg);
    const automod = readAutomod(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Security configs", "Protection status:", [
          { name: "Anti-raid", value: boolLabel(automod.antiRaid), inline: true },
          { name: "Anti-nuke", value: boolLabel(security.antiNukeEnabled), inline: true },
          { name: "Verification", value: boolLabel(security.verificationEnabled), inline: true },
        ]),
      );
    }

    if (sub === "anti-raid") {
      await client.config.updateGuild(interaction.guild!.id, { automod: mergeAutomod(automod, { antiRaid: true }) } as never);
      return reply(interaction, ok("Anti-raid enabled", "Anti-raid protection is now on."));
    }

    if (sub === "anti-raid-off") {
      await client.config.updateGuild(interaction.guild!.id, { automod: mergeAutomod(automod, { antiRaid: false }) } as never);
      return reply(interaction, ok("Anti-raid disabled", "Anti-raid protection is now off."));
    }

    if (sub === "anti-nuke") {
      await client.config.updateGuild(interaction.guild!.id, { security: mergeSecurity(security, { antiNukeEnabled: true }) } as never);
      return reply(interaction, ok("Anti-nuke enabled", "Anti-nuke protection flag is on."));
    }

    if (sub === "anti-nuke-off") {
      await client.config.updateGuild(interaction.guild!.id, { security: mergeSecurity(security, { antiNukeEnabled: false }) } as never);
      return reply(interaction, ok("Anti-nuke disabled", "Anti-nuke protection flag is off."));
    }

    const mode = interaction.options.getString("mode", true);
    await client.config.updateGuild(interaction.guild!.id, {
      security: mergeSecurity(security, { verificationEnabled: mode === "on" }),
    } as never);
    return reply(
      interaction,
      ok("Verification", `Verification is **${mode === "on" ? "enabled" : "disabled"}**.`),
    );
  },
});
