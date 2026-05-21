import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { alert, reply } from "../../core/commandUi.js";

export const musicCategoryCommand = createCategoryConfigCommand({
  name: "music",
  description: "Music system configuration.",
  meta: manageGuildMeta,
  subcommands: [{ name: "status", description: "Show music system status." }],
  async execute(interaction, sub) {
    if (sub !== "status") return;
    return reply(
      interaction,
      alert(
        "Music configs",
        "Voice music playback is not enabled on this bot build. No Lavalink/node connection is configured.",
      ),
    );
  },
});
