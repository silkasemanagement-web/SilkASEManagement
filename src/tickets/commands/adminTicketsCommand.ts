import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { neutral, ok, reply } from "../../core/commandUi.js";
import { TicketModel } from "../../models/Ticket.js";
import { TicketRepository } from "../repository.js";

export const adminTicketsSlashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Administrator tools.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((g) =>
      g
        .setName("tickets")
        .setDescription("Ticket system administration.")
        .addSubcommand((s) => s.setName("reset").setDescription("Clear all ticket records for this server (DB only)."))
        .addSubcommand((s) => s.setName("repair").setDescription("Sync ticket statuses with existing channels."))
        .addSubcommand((s) => s.setName("diagnostics").setDescription("Run ticket system diagnostics.")),
    ),
  meta: { requireAdmin: true, cooldownMs: 5000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.options.getSubcommandGroup() !== "tickets") return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "reset") {
      const result = await TicketModel.deleteMany({ guildId });
      return reply(interaction, ok("Reset", `Removed **${result.deletedCount}** ticket record(s) from the database.`));
    }

    if (sub === "repair") {
      const docs = await TicketModel.find({ guildId, status: { $in: ["open", "claimed", "locked", "closed"] } }).lean();
      let fixed = 0;
      for (const doc of docs) {
        const ch = await interaction.guild.channels.fetch(doc.channelId).catch(() => null);
        if (!ch) {
          await TicketRepository.setStatus(doc.channelId, "archived", { closeReason: "Repair: channel missing" });
          fixed++;
        }
      }
      return reply(interaction, ok("Repair", `Repaired **${fixed}** orphaned record(s).`));
    }

    if (sub === "diagnostics") {
      const client = interaction.client as ArkBotClient;
      const me = interaction.guild.members.me;
      const stats = await TicketRepository.guildStats(guildId);
      const perms =
        (me?.permissions.has(PermissionFlagsBits.ManageChannels) && me.permissions.has(PermissionFlagsBits.ManageRoles)) ??
        false;
      return reply(interaction, neutral("Ticket diagnostics", "System health check:", [
        { name: "Bot Manage Channels", value: perms ? "Yes" : "No", inline: true },
        { name: "Queue (transcripts)", value: client.queues.heavyQueue ? "Redis/BullMQ" : "Inline (dev)", inline: true },
        { name: "Open tickets", value: String(stats.open), inline: true },
        { name: "Total records", value: String(stats.total), inline: true },
      ]));
    }
  },
};
