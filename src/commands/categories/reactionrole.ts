import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { neutral, reply } from "../../core/commandUi.js";

export const reactionroleCategoryCommand = createCategoryConfigCommand({
  name: "reactionrole",
  description: "Reaction role panel configuration.",
  meta: manageGuildMeta,
  subcommands: [{ name: "status", description: "Show reaction role setup." }],
  async execute(interaction, sub) {
    if (sub !== "status") return;
    return reply(
      interaction,
      neutral("Reaction role configs", "Use `/reaction-role-create` to publish a reaction role panel in a channel."),
    );
  },
});
