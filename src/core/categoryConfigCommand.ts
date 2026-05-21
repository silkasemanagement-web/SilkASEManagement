import { SlashCommandBuilder, type ChatInputCommandInteraction, type SlashCommandSubcommandBuilder } from "discord.js";
import type { ArkBotClient } from "../client/ArkBotClient.js";
import type { CommandMeta, SlashCommand } from "../interfaces/ICommand.js";
import { manageGuildMeta } from "./commandMeta.js";

export type ConfigSubcommand = {
  name: string;
  description: string;
  configure?: (sub: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
};

export type CategoryConfigHandler = (
  interaction: ChatInputCommandInteraction,
  sub: string,
  client: ArkBotClient,
) => Promise<void>;

export function createCategoryConfigCommand(input: {
  name: string;
  description: string;
  meta?: CommandMeta;
  subcommands: ConfigSubcommand[];
  execute: CategoryConfigHandler;
}): SlashCommand {
  const builder = new SlashCommandBuilder().setName(input.name).setDescription(input.description);
  builder.addSubcommandGroup((group) => {
    group.setName("configs").setDescription(`Configure ${input.name} settings.`);
    for (const sub of input.subcommands) {
      group.addSubcommand((cmd) => {
        cmd.setName(sub.name).setDescription(sub.description);
        return sub.configure ? sub.configure(cmd) : cmd;
      });
    }
    return group;
  });

  return {
    data: builder,
    meta: input.meta ?? manageGuildMeta,
    async execute(interaction) {
      if (!interaction.isChatInputCommand() || !interaction.guild) return;
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();
      if (group !== "configs") return;
      const client = interaction.client as ArkBotClient;
      await input.execute(interaction, sub, client);
    },
  };
}
