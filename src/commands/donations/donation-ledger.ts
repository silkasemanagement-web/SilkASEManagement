import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DONATION_METHODS, DonationLedgerModel } from "../../models/DonationLedger.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

const METHOD_CHOICES = [
  { name: "PayPal", value: "paypal" },
  { name: "Venmo", value: "venmo" },
  { name: "PlayStation gift card", value: "playstation_gift_card" },
  { name: "Cash App", value: "cash_app" },
  { name: "Discord boost", value: "discord_boost" },
  { name: "Visa gift card", value: "visa_gift_card" },
] as const;

function methodLabel(method: string) {
  return METHOD_CHOICES.find((choice) => choice.value === method)?.name ?? method;
}

const donationMeta = {
  requiredDiscordPermissions: [PermissionFlagsBits.ManageGuild],
  cooldownMs: 5000,
};

export const donationAddCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("donation-add")
    .setDescription("Add a donation amount to a user's donation total.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName("user").setDescription("Donor").setRequired(true))
    .addNumberOption((option) => option.setName("amount").setDescription("Amount to add").setRequired(true).setMinValue(0.01))
    .addStringOption((option) =>
      option.setName("method").setDescription("Donation method").setRequired(true).addChoices(...METHOD_CHOICES),
    )
    .addStringOption((option) => option.setName("note").setDescription("Optional note").setMaxLength(512)),
  meta: donationMeta,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const amount = interaction.options.getNumber("amount", true);
    const method = interaction.options.getString("method", true);
    const note = interaction.options.getString("note") ?? undefined;
    if (!DONATION_METHODS.includes(method as (typeof DONATION_METHODS)[number])) return;

    await DonationLedgerModel.create({
      guildId: interaction.guild.id,
      userId: user.id,
      usernameSnapshot: user.tag,
      amount,
      method,
      note,
      action: "add",
      moderatorId: interaction.user.id,
    });

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "donation",
          title: "Donation added",
          description: `Added **$${amount.toFixed(2)}** for ${user} via **${methodLabel(method)}**.`,
          fields: note ? [{ name: "Note", value: note }] : [],
        }),
      ],
    });
  },
};

export const donationRemoveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("donation-remove")
    .setDescription("Remove a donation amount from a user's donation total.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName("user").setDescription("Donor").setRequired(true))
    .addNumberOption((option) => option.setName("amount").setDescription("Amount to remove").setRequired(true).setMinValue(0.01))
    .addStringOption((option) =>
      option.setName("method").setDescription("Donation method").setRequired(true).addChoices(...METHOD_CHOICES),
    )
    .addStringOption((option) => option.setName("note").setDescription("Optional note").setMaxLength(512)),
  meta: donationMeta,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const amount = interaction.options.getNumber("amount", true);
    const method = interaction.options.getString("method", true);
    const note = interaction.options.getString("note") ?? undefined;
    if (!DONATION_METHODS.includes(method as (typeof DONATION_METHODS)[number])) return;

    await DonationLedgerModel.create({
      guildId: interaction.guild.id,
      userId: user.id,
      usernameSnapshot: user.tag,
      amount: -amount,
      method,
      note,
      action: "remove",
      moderatorId: interaction.user.id,
    });

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "Donation removed",
          description: `Removed **$${amount.toFixed(2)}** from ${user} via **${methodLabel(method)}**.`,
          fields: note ? [{ name: "Note", value: note }] : [],
        }),
      ],
    });
  },
};

export const donationsListCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("donations-list")
    .setDescription("List donation totals by user.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  meta: donationMeta,
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const totals = await DonationLedgerModel.aggregate<{
      _id: string;
      total: number;
      usernameSnapshot?: string;
      methods: string[];
    }>([
      { $match: { guildId: interaction.guild.id } },
      {
        $group: {
          _id: "$userId",
          total: { $sum: "$amount" },
          usernameSnapshot: { $last: "$usernameSnapshot" },
          methods: { $addToSet: "$method" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 25 },
    ]);
    const lines = totals
      .filter((row) => row.total !== 0)
      .map(
        (row, index) =>
          `**${index + 1}.** <@${row._id}> — **$${row.total.toFixed(2)}** (${row.methods.map(methodLabel).join(", ")})`,
      );

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "donation",
          title: "Donation totals",
          description: lines.length ? lines.join("\n").slice(0, 4000) : "No donations have been recorded yet.",
        }),
      ],
    });
  },
};
