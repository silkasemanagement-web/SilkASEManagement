import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { alert, neutral, ok, reply } from "../../core/commandUi.js";
import { readTicketCategoryMap, readTickets } from "../../core/guildConfigFields.js";
import { mergeTickets } from "../../core/guildConfigPatch.js";
import {
  TICKET_CATEGORY_KEYS,
  TICKET_CATEGORY_LABELS,
  TICKET_PARENT_CATEGORY_IDS,
  type TicketCategoryKey,
} from "../constants.js";
import { TicketRepository } from "../repository.js";
import { TicketService } from "../service.js";
import { TicketModel } from "../../models/Ticket.js";

const CONFIG_CATEGORY_CHOICES = TICKET_CATEGORY_KEYS.filter((k) => k !== "giveaway_winner").map((key) => ({
  name: TICKET_CATEGORY_LABELS[key],
  value: key,
}));

export const ticketsSlashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("tickets")
    .setDescription("Ticket system configuration and maintenance.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("setup").setDescription("Apply default ticket category mappings."))
    .addSubcommand((s) => s.setName("stats").setDescription("View ticket statistics."))
    .addSubcommand((s) => s.setName("reload").setDescription("Refresh ticket config cache."))
    .addSubcommand((s) => s.setName("cleanup").setDescription("Archive orphaned ticket DB records."))
    .addSubcommand((s) =>
      s
        .setName("close-all")
        .setDescription("Close every open ticket (exports transcripts).")
        .addBooleanOption((o) => o.setName("confirm").setDescription("Type true to confirm").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("delete-all")
        .setDescription("Delete every ticket channel and archive records.")
        .addBooleanOption((o) => o.setName("confirm").setDescription("Type true to confirm").setRequired(true))
        .addBooleanOption((o) =>
          o.setName("export_transcripts").setDescription("Export transcripts before delete (default true)"),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName("configs")
        .setDescription("Configure ticket settings.")
        .addSubcommand((s) => s.setName("status").setDescription("Show ticket configuration."))
        .addSubcommand((s) =>
          s
            .setName("category")
            .setDescription("Map ticket type to Discord category.")
            .addChannelOption((o) => o.setName("channel").setDescription("Parent category").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addStringOption((o) =>
              o.setName("category").setDescription("Ticket type").setRequired(false).addChoices(...CONFIG_CATEGORY_CHOICES),
            ),
        )
        .addSubcommand((s) => s.setName("roles").setDescription("Add a ticket staff role.").addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)))
        .addSubcommand((s) =>
          s
            .setName("transcripts")
            .setDescription("Set transcript log channel.")
            .addChannelOption((o) => o.setName("channel").setDescription("Log channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),
        )
        .addSubcommand((s) => s.setName("limits").setDescription("Max open tickets per user.").addIntegerOption((o) => o.setName("max").setDescription("Max").setRequired(true).setMinValue(1).setMaxValue(25)))
        .addSubcommand((s) => s.setName("inactivity").setDescription("Auto-close inactive tickets (hours).").addIntegerOption((o) => o.setName("hours").setDescription("Hours").setRequired(true).setMinValue(1).setMaxValue(8760)))
        .addSubcommand((s) => s.setName("ticket-message").setDescription("Welcome message for new tickets.").addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true).setMaxLength(2000))),
    ),
  meta: { ...manageGuildMeta, deferReply: true, deferEphemeral: true, cooldownMs: 30_000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const client = interaction.client as ArkBotClient;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (!group) {
      if (sub === "setup") {
        const cfg = await client.config.getGuild(guildId);
        const tickets = readTickets(cfg);
        const merged = { ...TICKET_PARENT_CATEGORY_IDS, ...readTicketCategoryMap(cfg) };
        await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { categories: merged as never }) } as never);
        return reply(interaction, ok("Setup", "Default ticket categories applied where IDs exist."));
      }
      if (sub === "stats") {
        const stats = await new TicketService(client).getStats(guildId);
        return reply(interaction, neutral("Stats", "Ticket statistics for this server:", [
          { name: "Total", value: String(stats.total), inline: true },
          { name: "Open", value: String(stats.open), inline: true },
          { name: "Closed", value: String(stats.closed), inline: true },
          { name: "Archived", value: String(stats.archived), inline: true },
        ]));
      }
      if (sub === "reload") {
        return reply(interaction, ok("Reloaded", "Config reloaded from database."));
      }
      if (sub === "cleanup") {
        const docs = await TicketModel.find({ guildId, status: { $in: ["open", "claimed", "locked", "closed"] } }).lean();
        let n = 0;
        for (const doc of docs) {
          const ch = await interaction.guild.channels.fetch(doc.channelId).catch(() => null);
          if (!ch) {
            await TicketRepository.setStatus(doc.channelId, "archived", { closeReason: "Cleanup" });
            n++;
          }
        }
        return reply(interaction, ok("Cleanup", `Archived **${n}** orphan record(s).`));
      }

      if (sub === "close-all") {
        if (!interaction.options.getBoolean("confirm")) {
          return reply(interaction, alert("Cancelled", "Bulk close was not confirmed. Set **confirm** to `true`."));
        }
        const svc = new TicketService(client);
        const result = await svc.closeAllTickets({
          guild: interaction.guild,
          staffId: interaction.user.id,
          reason: "Bulk close via /tickets close-all",
        });
        const errNote = result.errors.length ? `\n\nIssues:\n${result.errors.join("\n")}` : "";
        return reply(
          interaction,
          ok(
            "Close all",
            `Processed **${result.total}** ticket(s): **${result.closed}** closed, **${result.skipped}** skipped.${errNote}`,
          ),
        );
      }

      if (sub === "delete-all") {
        if (!interaction.options.getBoolean("confirm")) {
          return reply(interaction, alert("Cancelled", "Bulk delete was not confirmed. Set **confirm** to `true`."));
        }
        const exportTranscripts = interaction.options.getBoolean("export_transcripts") ?? true;
        const svc = new TicketService(client);
        const result = await svc.deleteAllTickets({
          guild: interaction.guild,
          staffId: interaction.user.id,
          exportTranscripts,
        });
        const errNote = result.errors.length ? `\n\nIssues:\n${result.errors.join("\n")}` : "";
        return reply(
          interaction,
          ok(
            "Delete all",
            `Processed **${result.total}** ticket(s): **${result.deleted}** deleted, **${result.skipped}** skipped.${errNote}`,
          ),
        );
      }

      return;
    }

    if (group !== "configs") return;
    const cfg = await client.config.getGuild(guildId);
    const tickets = readTickets(cfg);

    if (sub === "status") {
      const categories = readTicketCategoryMap(cfg);
      const lines = Object.entries(categories).map(([k, v]) => `**${TICKET_CATEGORY_LABELS[k as TicketCategoryKey] ?? k}** → <#${v}>`);
      return reply(interaction, neutral("Ticket config", "Current ticket settings:", [
        { name: "Categories", value: lines.length ? lines.join("\n") : "None", inline: false },
        { name: "Staff roles", value: tickets.staffRoleIds?.map((id) => `<@&${id}>`).join(", ") || "None", inline: false },
        { name: "Transcripts", value: tickets.transcriptLogChannelId ? `<#${tickets.transcriptLogChannelId}>` : "Not set", inline: true },
        { name: "Max open / user", value: String(tickets.maxOpenPerUser ?? 3), inline: true },
        { name: "Auto-close (h)", value: String(tickets.autoCloseInactiveHours ?? 72), inline: true },
      ]));
    }

    if (sub === "category") {
      const key = (interaction.options.getString("category") ?? "general_support") as TicketCategoryKey;
      const channel = interaction.options.getChannel("channel", true);
      const current = readTicketCategoryMap(cfg);
      await client.config.updateGuild(guildId, {
        tickets: mergeTickets(tickets, { categories: { ...current, [key]: channel.id } } as never),
      } as never);
      return reply(interaction, ok("Category", `${TICKET_CATEGORY_LABELS[key]} → <#${channel.id}>`));
    }

    if (sub === "roles") {
      const role = interaction.options.getRole("role", true);
      const merged = [...new Set([...(tickets.staffRoleIds ?? []), role.id])];
      await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { staffRoleIds: merged }) } as never);
      return reply(interaction, ok("Staff roles", `Added ${role}. Total: **${merged.length}** role(s).`));
    }

    if (sub === "transcripts") {
      const channel = interaction.options.getChannel("channel", true);
      await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { transcriptLogChannelId: channel.id }) } as never);
      return reply(interaction, ok("Transcripts", `Log channel: <#${channel.id}>`));
    }

    if (sub === "limits") {
      const max = interaction.options.getInteger("max", true);
      await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { maxOpenPerUser: max }) } as never);
      return reply(interaction, ok("Limits", `Max open tickets per user: **${max}**`));
    }

    if (sub === "inactivity") {
      const hours = interaction.options.getInteger("hours", true);
      await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { autoCloseInactiveHours: hours }) } as never);
      return reply(interaction, ok("Inactivity", `Auto-close after **${hours}** hours.`));
    }

    const message = interaction.options.getString("message", true);
    await client.config.updateGuild(guildId, { tickets: mergeTickets(tickets, { welcomeMessage: message }) } as never);
    return reply(interaction, ok("Welcome message", "Ticket welcome text updated."));
  },
};
