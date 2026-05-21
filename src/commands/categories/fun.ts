import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { publicMeta } from "../../core/commandMeta.js";
import { neutral, reply } from "../../core/commandUi.js";

export const funCategoryCommand = createCategoryConfigCommand({
  name: "fun",
  description: "Fun commands and mini-games.",
  meta: { ...publicMeta, deferEphemeral: true },
  subcommands: [{ name: "status", description: "Show fun commands." }],
  async execute(interaction, sub) {
    if (sub !== "status") return;
    return reply(
      interaction,
      neutral(
        "Fun configs",
        "Fun commands: `/coin-flip`, `/rock-paper-scissors`, `/animal`, `/wallet daily`, event mini-games in configured channels.",
      ),
    );
  },
});
