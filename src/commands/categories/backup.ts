import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

export const backupCategoryCommand = createCategoryConfigCommand({
  name: "backup",
  description: "Server backup configuration.",
  meta: adminMeta,
  subcommands: [
    { name: "status", description: "Show backup settings." },
    {
      name: "webhook",
      description: "Set backup notification webhook URL.",
      configure: (sub) => sub.addStringOption((o) => o.setName("url").setDescription("Webhook URL").setRequired(true).setMaxLength(512)),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const backups = (cfg.backups ?? {}) as import("../../core/guildConfigFields.js").BackupsConfig;

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Backup configs", "Backup settings:", [
          { name: "Webhook", value: backups.webhookUrl ? "Configured" : "Not set", inline: true },
          { name: "Last run", value: backups.lastRunAt ? `<t:${Math.floor(backups.lastRunAt.getTime() / 1000)}:R>` : "Never", inline: true },
        ]),
      );
    }

    const url = interaction.options.getString("url", true);
    await client.config.updateGuild(interaction.guild!.id, {
      backups: { ...backups, webhookUrl: url },
    } as never);
    return reply(interaction, ok("Backup webhook saved", "Backup notifications will use the new webhook."));
  },
});
