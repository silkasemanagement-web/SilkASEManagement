import type { SlashCommand } from "../interfaces/ICommand.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";

export async function registerSlashCommands(client: ArkBotClient, commands: SlashCommand[]) {
  client.commands.clear();
  for (const cmd of commands) {
    const data = typeof cmd.data === "function" ? cmd.data() : cmd.data;
    if (client.commands.has(data.name)) {
      throw new Error(`Duplicate slash command registered: ${data.name}`);
    }
    client.commands.set(data.name, cmd);
  }
}
