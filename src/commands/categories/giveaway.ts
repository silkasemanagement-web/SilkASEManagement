import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { neutral, reply } from "../../core/commandUi.js";

export const giveawayCategoryCommand = createCategoryConfigCommand({
  name: "giveaway",
  description: "Giveaway system configuration.",
  meta: manageGuildMeta,
  subcommands: [{ name: "status", description: "Show giveaway commands and setup." }],
  async execute(interaction, sub) {
    if (sub !== "status") return;
    return reply(
      interaction,
      neutral("Giveaway configs", "Giveaway commands:", [
        { name: "Create", value: "`/giveaway-create`", inline: true },
        { name: "End", value: "`/giveaway-end`", inline: true },
        { name: "Cancel", value: "`/giveaway-cancel`", inline: true },
      ]),
    );
  },
});
