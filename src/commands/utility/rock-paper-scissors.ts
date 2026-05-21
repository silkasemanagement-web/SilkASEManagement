import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

const choices = ["rock", "paper", "scissors"] as const;
type Choice = (typeof choices)[number];

function winningChoiceAgainst(choice: Choice) {
  return choice === "rock" ? "paper" : choice === "paper" ? "scissors" : "rock";
}

function resultFor(player: Choice, bot: Choice) {
  if (player === bot) return "tie" as const;
  return winningChoiceAgainst(bot) === player ? "win" : "lose";
}

function display(choice: Choice) {
  return choice === "rock" ? "Rock" : choice === "paper" ? "Paper" : "Scissors";
}

export const rockPaperScissorsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("rock-paper-scissors")
    .setDescription("Play rock paper scissors against the bot.")
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("Choose rock, paper, or scissors")
        .setRequired(true)
        .addChoices(
          { name: "Rock", value: "rock" },
          { name: "Paper", value: "paper" },
          { name: "Scissors", value: "scissors" },
        ),
    ),
  meta: { cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const player = interaction.options.getString("choice", true) as Choice;
    const bot = choices[Math.floor(Math.random() * choices.length)];
    const result = resultFor(player, bot);
    const title = result === "win" ? "You won" : result === "lose" ? "You lost" : "Tie game";

    await interaction.reply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: result === "win" ? "ark" : result === "lose" ? "alert" : "neutral",
          title: "Rock Paper Scissors",
          description: `You chose **${display(player)}**.\nI chose **${display(bot)}**.\n\n**${title}!**`,
        }),
      ],
    });
  },
};
