import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { publicMeta } from "../../core/commandMeta.js";
import { addBalance, formatCurrency, getBalance } from "../../core/economyStore.js";
import { alert, neutral, ok, reply } from "../../core/commandUi.js";
import { FeatureStoreService } from "../../services/FeatureStoreService.js";

const store = new FeatureStoreService();

const ANIMALS = [
  { name: "Dodo", value: "dodo", price: 25 },
  { name: "Raptor", value: "raptor", price: 100 },
  { name: "Argentavis", value: "argentavis", price: 250 },
  { name: "Rex", value: "rex", price: 500 },
  { name: "Giga", value: "giga", price: 1000 },
] as const;

type AnimalKey = (typeof ANIMALS)[number]["value"];

function animalByKey(key: string) {
  return ANIMALS.find((animal) => animal.value === key);
}

export const animalCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("animal")
    .setDescription("Buy, view, and use animals.")
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("Buy an animal using your economy balance.")
        .addStringOption((o) =>
          o
            .setName("animal")
            .setDescription("Animal to buy")
            .setRequired(true)
            .addChoices(...ANIMALS.map((animal) => ({ name: `${animal.name} - ${formatCurrency(animal.price)}`, value: animal.value }))),
        ),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List your animals."))
    .addSubcommand((sub) =>
      sub
        .setName("race")
        .setDescription("Race one of your animals.")
        .addStringOption((o) => o.setName("animal").setDescription("Animal to race").setRequired(true).addChoices(...ANIMALS.map((animal) => ({ name: animal.name, value: animal.value })))),
    )
    .addSubcommand((sub) =>
      sub
        .setName("train")
        .setDescription("Train one of your animals.")
        .addStringOption((o) => o.setName("animal").setDescription("Animal to train").setRequired(true).addChoices(...ANIMALS.map((animal) => ({ name: animal.name, value: animal.value })))),
    ),
  meta: publicMeta,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const inventory = (await store.get<{ owned?: AnimalKey[]; trained?: Record<string, number> }>(guildId, "animals", userId)) ?? { owned: [], trained: {} };
    const owned = new Set(inventory.owned ?? []);
    const trained = inventory.trained ?? {};
    if (sub === "list") {
      return reply(interaction, neutral("Your animals", owned.size ? [...owned].map((key) => `**${animalByKey(key)?.name ?? key}** — training ${trained[key] ?? 0}`).join("\n") : "You do not own any animals yet. Use `/animal buy`."));
    }
    const key = interaction.options.getString("animal", true) as AnimalKey;
    const animal = animalByKey(key);
    if (!animal) return reply(interaction, alert("Animal", "Unknown animal."));
    if (sub === "buy") {
      if (owned.has(key)) return reply(interaction, alert("Animal shop", `You already own a **${animal.name}**.`));
      const balance = await getBalance(guildId, userId);
      if (balance < animal.price) {
        return reply(interaction, alert("Animal shop", `You need **${formatCurrency(animal.price)}** to buy **${animal.name}**.\nYour balance: **${formatCurrency(balance)}**.`));
      }
      await addBalance(guildId, userId, -animal.price, userId);
      owned.add(key);
      await store.set(guildId, "animals", userId, { owned: [...owned], trained }, userId);
      return reply(interaction, ok("Animal purchased", `You bought a **${animal.name}** for **${formatCurrency(animal.price)}**.`));
    }
    if (!owned.has(key)) return reply(interaction, alert("Animal", `You do not own a **${animal.name}** yet.`));
    if (sub === "train") {
      trained[key] = (trained[key] ?? 0) + 1;
      await store.set(guildId, "animals", userId, { owned: [...owned], trained }, userId);
      return reply(interaction, ok("Animal trained", `Your **${animal.name}** is now training level **${trained[key]}**.`));
    }
    const score = Math.floor(Math.random() * 100) + (trained[key] ?? 0) * 5;
    const winnings = score >= 60 ? 100 : 0;
    if (winnings) await addBalance(guildId, userId, winnings, userId);
    return reply(interaction, winnings ? ok("Animal race", `Your **${animal.name}** won the race and earned **${formatCurrency(winnings)}**.`) : alert("Animal race", `Your **${animal.name}** lost the race. Train it and try again.`));
  },
};
export const groupedExpansionCommands: SlashCommand[] = [animalCommand];
