import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { adminMeta } from "../../core/commandMeta.js";
import { alert, neutral, reply } from "../../core/commandUi.js";

export const aiCategoryCommand = createCategoryConfigCommand({
  name: "ai",
  description: "AI assistant configuration.",
  meta: adminMeta,
  subcommands: [{ name: "status", description: "Show AI module status." }],
  async execute(interaction, sub, client) {
    if (sub !== "status") return;
    const configured = Boolean(client.env.OPENAI_API_KEY);
    return reply(
      interaction,
      configured
        ? neutral("AI configs", "OpenAI API key is loaded from the server environment. AI chat commands can be enabled in a future update.")
        : alert("AI configs", "No OpenAI API key found. Add `OPENAI_API_KEY` to your `.env` file and restart the bot."),
    );
  },
});
