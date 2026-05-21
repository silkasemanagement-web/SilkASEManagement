import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { neutral, reply } from "../../core/commandUi.js";

export const levelsCategoryCommand = createCategoryConfigCommand({
  name: "levels",
  description: "Leveling system configuration.",
  meta: manageGuildMeta,
  subcommands: [{ name: "status", description: "Show leveling system status." }],
  async execute(interaction, sub) {
    if (sub !== "status") return;
    return reply(
      interaction,
      neutral(
        "Level configs",
        "XP leveling is not fully automated yet. Message XP tracking and rank cards can be enabled in a future update. Use `/config` for staff roles and logging while this module is expanded.",
      ),
    );
  },
});
