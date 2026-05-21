import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../interfaces/ICommand.js";
import { publicMeta } from "../core/commandMeta.js";
import { formatCurrency, getBalance, addBalance } from "../core/economyStore.js";
import { alert, neutral, ok, reply, valueList } from "../core/commandUi.js";
import { FeatureStoreService } from "../services/FeatureStoreService.js";

const store = new FeatureStoreService();

export const walletCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Check balance and use the server economy.")
    .addSubcommand((sub) => sub.setName("balance").setDescription("Show your balance."))
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("Pay another member.")
        .addUserOption((o) => o.setName("user").setDescription("Recipient").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),
    )
    .addSubcommand((sub) => sub.setName("leaderboard").setDescription("Top balances."))
    .addSubcommand((sub) => sub.setName("work").setDescription("Work for money."))
    .addSubcommand((sub) => sub.setName("crime").setDescription("Risky crime attempt."))
    .addSubcommand((sub) => sub.setName("daily").setDescription("Claim daily reward."))
    .addSubcommand((sub) => sub.setName("weekly").setDescription("Claim weekly reward.")),
  meta: publicMeta,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const cfg = await (interaction.client as import("../client/ArkBotClient.js").ArkBotClient).config.getGuild(guildId);
    const economyCfg = (cfg as { economy?: { dailyReward?: number; weeklyReward?: number } }).economy ?? {};

    if (sub === "balance") {
      const balance = await getBalance(guildId, interaction.user.id);
      return reply(interaction, neutral("Wallet", `Balance: **${formatCurrency(balance)}**`));
    }

    if (sub === "give") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const balance = await getBalance(guildId, interaction.user.id);
      if (balance < amount) return reply(interaction, alert("Wallet", "Insufficient funds."));
      await addBalance(guildId, interaction.user.id, -amount, interaction.user.id);
      const recipient = await addBalance(guildId, user.id, amount, interaction.user.id);
      return reply(interaction, ok("Payment sent", `Sent **${formatCurrency(amount)}** to ${user}.\nTheir balance: **${formatCurrency(recipient)}**.`));
    }

    if (sub === "leaderboard") {
      const rows = await store.list<{ balance?: number }>(guildId, "economy-balances");
      const sorted = rows.sort((a, b) => Number(b.data.balance ?? 0) - Number(a.data.balance ?? 0)).slice(0, 10);
      return reply(
        interaction,
        neutral("Leaderboard", valueList(sorted.map((row, i) => `**${i + 1}.** <@${row.key}> — ${formatCurrency(Number(row.data.balance ?? 0))}`))),
      );
    }

    const rewards: Record<string, number> = {
      work: 75,
      crime: Math.random() < 0.5 ? 150 : -50,
      daily: economyCfg.dailyReward ?? 250,
      weekly: economyCfg.weeklyReward ?? 1000,
    };
    const reward = rewards[sub] ?? 0;
    const next = await addBalance(guildId, interaction.user.id, reward, interaction.user.id);
    return reply(
      interaction,
      reward >= 0
        ? ok("Reward", `You earned **${formatCurrency(reward)}**.\nBalance: **${formatCurrency(next)}**.`)
        : alert("Crime failed", `You lost **${formatCurrency(Math.abs(reward))}**.\nBalance: **${formatCurrency(next)}**.`),
    );
  },
};
