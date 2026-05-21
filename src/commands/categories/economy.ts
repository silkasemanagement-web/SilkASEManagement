import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { readEconomy } from "../../core/guildConfigFields.js";
import { mergeEconomy } from "../../core/guildConfigPatch.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

export const economyCategoryCommand = createCategoryConfigCommand({
  name: "economy",
  description: "Economy system configuration.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show economy configuration." },
    {
      name: "rewards",
      description: "Set daily and weekly reward amounts.",
      configure: (sub) =>
        sub
          .addIntegerOption((o) => o.setName("daily").setDescription("Daily reward").setMinValue(1).setMaxValue(100000))
          .addIntegerOption((o) => o.setName("weekly").setDescription("Weekly reward").setMinValue(1).setMaxValue(500000)),
    },
    { name: "reset-server", description: "Reset all economy balances for this server." },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const economy = readEconomy(cfg);

    if (sub === "status") {
      return reply(
        interaction,
        neutral("Economy configs", "Economy reward settings:", [
          { name: "Daily reward", value: String(economy.dailyReward ?? 250), inline: true },
          { name: "Weekly reward", value: String(economy.weeklyReward ?? 1000), inline: true },
          { name: "Gameplay", value: "Use `/wallet` for balance, pay, work, and rewards.", inline: false },
        ]),
      );
    }

    if (sub === "reset-server") {
      const { FeatureStoreService } = await import("../../services/FeatureStoreService.js");
      const store = new FeatureStoreService();
      const rows = await store.list(interaction.guild!.id, "economy-balances");
      await Promise.all(rows.map((row) => store.delete(interaction.guild!.id, "economy-balances", row.key)));
      return reply(interaction, ok("Economy reset", "All listed balances were reset."));
    }

    const daily = interaction.options.getInteger("daily");
    const weekly = interaction.options.getInteger("weekly");
    await client.config.updateGuild(interaction.guild!.id, {
      economy: mergeEconomy(economy, {
        ...(daily != null ? { dailyReward: daily } : {}),
        ...(weekly != null ? { weeklyReward: weekly } : {}),
      }),
    } as never);
    return reply(interaction, ok("Rewards saved", "Economy reward amounts were updated."));
  },
});
