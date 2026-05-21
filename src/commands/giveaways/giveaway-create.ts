import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { GiveawayModel } from "../../models/Giveaway.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { interactionTextChannel } from "../../utils/textChannel.js";
import { processDueGiveaways } from "../../workers/heavyJobProcessor.js";

export const giveawayCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway-create")
    .setDescription("Create a giveaway with timer and join button.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName("prize").setDescription("Prize text").setRequired(true).setMaxLength(200))
    .addIntegerOption((o) =>
      o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(10080),
    )
    .addIntegerOption((o) => o.setName("winners").setDescription("How many winners").setRequired(true).setMinValue(1).setMaxValue(20)),
  meta: { cooldownMs: 15_000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const tc = interactionTextChannel(interaction);
    if (!tc) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Giveaway",
            description: "Use this command in a server text channel.",
          }),
        ],
      });
      return;
    }
    const prize = interaction.options.getString("prize", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const winners = interaction.options.getInteger("winners", true);
    const endsAt = new Date(Date.now() + minutes * 60_000);
    const embed = DynamicEmbedBuilder.build({
      theme: "donation",
      title: "Giveaway",
      description: `**Prize:** ${prize}\nEnds: <t:${Math.floor(endsAt.getTime() / 1000)}:R>\nWinners: **${winners}**`,
    });
    const msg = await tc.send({ embeds: [embed] });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ae:gw:enter:${msg.id}`)
        .setLabel("Enter")
        .setStyle(ButtonStyle.Primary),
    );
    await msg.edit({ components: [row] });
    await GiveawayModel.create({
      guildId: interaction.guild.id,
      channelId: tc.id,
      messageId: msg.id,
      hostId: interaction.user.id,
      prize,
      endsAt,
      winnerCount: winners,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Giveaway posted",
          description: `[Jump](${msg.url})`,
        }),
      ],
    });
  },
};

export const giveawayEndCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway-end")
    .setDescription("End a giveaway now by message ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true).setMaxLength(25)),
  meta: { cooldownMs: 5000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const messageId = interaction.options.getString("message_id", true);
    const doc = await GiveawayModel.findOneAndUpdate({ messageId, status: "active" }, { $set: { endsAt: new Date(Date.now() - 1000) } }, { new: true });
    if (!doc) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Giveaway end", description: "Active giveaway not found." })] });
      return;
    }
    await processDueGiveaways(interaction.client as ArkBotClient, messageId);
    await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Giveaway ended", description: `Processed **${doc.prize}** and created winner ticket channels when possible.` })] });
  },
};

export const giveawayCancelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway-cancel")
    .setDescription("Cancel/self-destruct a giveaway by message ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true).setMaxLength(25)),
  meta: { cooldownMs: 5000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const messageId = interaction.options.getString("message_id", true);
    const doc = await GiveawayModel.findOneAndUpdate({ messageId }, { $set: { status: "cancelled" } }, { new: true });
    if (!doc) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Giveaway cancel", description: "Giveaway not found." })] });
      return;
    }
    await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Giveaway cancelled", description: `Cancelled **${doc.prize}**.` })] });
  },
};
