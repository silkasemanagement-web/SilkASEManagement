import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { readTicketCategoryMap, readTickets } from "../../core/guildConfigFields.js";
import { alert, neutral, ok, reply } from "../../core/commandUi.js";
import { isStaff } from "../../utils/discord.js";
import { interactionTextChannel } from "../../utils/textChannel.js";
import { TICKET_CATEGORY_KEYS, TICKET_CATEGORY_LABELS, TICKET_PARENT_CATEGORY_IDS, type TicketCategoryKey } from "../constants.js";
import { buildTicketPanelEmbed, buildTicketPanelMenu } from "../panel.js";
import { TicketRepository } from "../repository.js";
import { TicketService } from "../service.js";
import { FeatureStoreService } from "../../services/FeatureStoreService.js";
import { exportTicketTranscript } from "../transcript.js";

const panelStore = new FeatureStoreService();

const TICKET_CREATE_CHOICES = TICKET_CATEGORY_KEYS.filter((k) => k !== "giveaway_winner").map((key) => ({
  name: TICKET_CATEGORY_LABELS[key],
  value: key,
}));

async function requireTicketChannel(interaction: ChatInputCommandInteraction) {
  const channel = interactionTextChannel(interaction);
  if (!channel) throw new Error("Use this command inside the ticket channel.");
  const doc = await TicketRepository.findByChannel(channel.id);
  if (!doc) throw new Error("This channel is not a registered ticket.");
  return { channel, doc };
}

export const ticketSlashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Create and manage support tickets.")
    .addSubcommand((s) =>
      s
        .setName("create")
        .setDescription("Open a new support ticket.")
        .addStringOption((o) =>
          o.setName("category").setDescription("Ticket type").setRequired(false).addChoices(...TICKET_CREATE_CHOICES),
        ),
    )
    .addSubcommand((s) => s.setName("close").setDescription("Close this ticket.").addStringOption((o) => o.setName("reason").setDescription("Close reason").setMaxLength(512)))
    .addSubcommand((s) => s.setName("reopen").setDescription("Reopen a closed ticket."))
    .addSubcommand((s) => s.setName("lock").setDescription("Lock the ticket (users cannot send)."))
    .addSubcommand((s) => s.setName("unlock").setDescription("Unlock the ticket."))
    .addSubcommand((s) => s.setName("rename").setDescription("Rename the ticket channel.").addStringOption((o) => o.setName("name").setDescription("New name").setRequired(true).setMaxLength(90)))
    .addSubcommand((s) => s.setName("claim").setDescription("Claim this ticket."))
    .addSubcommand((s) => s.setName("unclaim").setDescription("Remove your claim."))
    .addSubcommand((s) => s.setName("add").setDescription("Add a user to this ticket.").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand((s) => s.setName("remove").setDescription("Remove a user from this ticket.").addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName("transfer")
        .setDescription("Transfer ticket to another staff member.")
        .addUserOption((o) => o.setName("staff").setDescription("Staff member").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("escalate").setDescription("Raise ticket priority."))
    .addSubcommand((s) =>
      s
        .setName("priority")
        .setDescription("Set ticket priority.")
        .addStringOption((o) =>
          o
            .setName("priority")
            .setDescription("Priority")
            .setRequired(true)
            .addChoices(
              { name: "Low", value: "low" },
              { name: "Normal", value: "normal" },
              { name: "High", value: "high" },
              { name: "Urgent", value: "urgent" },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("category")
        .setDescription("Move ticket to another category.")
        .addChannelOption((o) => o.setName("parent").setDescription("Discord category").addChannelTypes(ChannelType.GuildCategory).setRequired(true)),
    )
    .addSubcommand((s) => s.setName("transcript").setDescription("Export HTML + TXT transcript."))
    .addSubcommand((s) => s.setName("delete").setDescription("Delete ticket and export transcript."))
    .addSubcommand((s) => s.setName("archive").setDescription("Archive ticket (close + transcript).").addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(512)))
    .addSubcommand((s) => s.setName("status").setDescription("Show ticket status."))
    .addSubcommand((s) => s.setName("info").setDescription("Detailed ticket information."))
    .addSubcommand((s) => s.setName("notes").setDescription("Add an internal staff note.").addStringOption((o) => o.setName("note").setDescription("Note text").setRequired(true).setMaxLength(1000)))
    .addSubcommandGroup((g) =>
      g
        .setName("panel")
        .setDescription("Manage ticket panels.")
        .addSubcommand((s) => s.setName("create").setDescription("Save a panel template.").addStringOption((o) => o.setName("name").setDescription("Panel name").setRequired(true).setMaxLength(64)).addStringOption((o) => o.setName("message").setDescription("Panel description").setRequired(true).setMaxLength(2000)))
        .addSubcommand((s) => s.setName("edit").setDescription("Edit a panel template.").addStringOption((o) => o.setName("name").setDescription("Panel name").setRequired(true)).addStringOption((o) => o.setName("message").setDescription("New description").setRequired(true).setMaxLength(2000)))
        .addSubcommand((s) => s.setName("delete").setDescription("Delete a panel template.").addStringOption((o) => o.setName("name").setDescription("Panel name").setRequired(true)))
        .addSubcommand((s) =>
          s
            .setName("send")
            .setDescription("Post a panel to a channel.")
            .addStringOption((o) => o.setName("name").setDescription("Panel name").setRequired(true))
            .addChannelOption((o) => o.setName("channel").setDescription("Destination").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),
        ),
    ),
  meta: { cooldownMs: 2000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const client = interaction.client as ArkBotClient;
    const svc = new TicketService(client);
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    if (group === "panel") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return reply(interaction, alert("Panel", "You need **Manage Server** to manage panels."));
      }
      const name = interaction.options.getString("name", true);
      if (sub === "delete") {
        await panelStore.delete(interaction.guild.id, "ticket-panels", name);
        return reply(interaction, ok("Panel deleted", `Removed **${name}**.`));
      }
      if (sub === "create" || sub === "edit") {
        const message = interaction.options.getString("message", true);
        await panelStore.set(interaction.guild.id, "ticket-panels", name, { message }, interaction.user.id);
        return reply(interaction, ok("Panel saved", `Panel **${name}** saved.`));
      }
      const panel = await panelStore.get<{ message: string }>(interaction.guild.id, "ticket-panels", name);
      const dest = interaction.options.getChannel("channel", true);
      const ch = await interaction.guild.channels.fetch(dest.id).catch(() => null);
      if (!ch?.isTextBased() || !("send" in ch)) return reply(interaction, alert("Panel", "Invalid channel."));
      await ch.send({ embeds: [buildTicketPanelEmbed({ description: panel?.message })], components: [buildTicketPanelMenu(interaction.guild)] });
      return reply(interaction, ok("Panel sent", `Posted **${name}** to <#${dest.id}>.`));
    }

    if (sub === "create") {
      const key = (interaction.options.getString("category") ?? "general_support") as TicketCategoryKey;
      const cfg = await client.config.getGuild(interaction.guild.id);
      const tickets = readTickets(cfg);
      const parentId = readTicketCategoryMap(cfg)[key] ?? TICKET_PARENT_CATEGORY_IDS[key];
      if (!parentId) return reply(interaction, alert("Ticket", `No category configured for **${TICKET_CATEGORY_LABELS[key]}**.`));
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const staffIds = await svc.resolveStaffRoleIds(interaction.guild, tickets.staffRoleIds ?? [], cfg.staffRoleIds ?? []);
      const result = await svc.createTicket({
        guild: interaction.guild,
        opener: member,
        categoryKey: key,
        parentCategoryId: parentId,
        staffRoleIds: staffIds,
        openedVia: "slash",
        maxOpenPerUser: tickets.maxOpenPerUser,
        welcomeMessage: tickets.welcomeMessage ?? undefined,
      });
      return reply(
        interaction,
        result.ok ? ok("Ticket opened", `Ticket **#${result.ticketNumber}** → <#${result.channelId}>`) : alert("Ticket", result.message),
      );
    }

    const cfg = await client.config.getGuild(interaction.guild.id);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const staff = isStaff(member, cfg);

    if (sub === "status" || sub === "info") {
      try {
        const { doc } = await requireTicketChannel(interaction);
        const fields = [
          { name: "Number", value: `#${doc.ticketNumber}`, inline: true },
          { name: "Status", value: doc.status, inline: true },
          { name: "Priority", value: doc.priority, inline: true },
          { name: "Category", value: TICKET_CATEGORY_LABELS[doc.categoryKey as TicketCategoryKey] ?? doc.categoryKey, inline: true },
          { name: "Opener", value: `<@${doc.openerId}>`, inline: true },
          { name: "Claimed", value: doc.claimedById ? `<@${doc.claimedById}>` : "—", inline: true },
        ];
        if (sub === "info") {
          fields.push(
            { name: "Participants", value: doc.participants?.map((id) => `<@${id}>`).join(", ") || "—", inline: false },
            { name: "Notes", value: doc.staffNotes?.length ? `${doc.staffNotes.length} staff note(s)` : "None", inline: true },
          );
        }
        return reply(interaction, neutral(`Ticket #${doc.ticketNumber}`, `Channel <#${doc.channelId}>`, fields));
      } catch (e) {
        return reply(interaction, alert("Ticket", e instanceof Error ? e.message : "Error"));
      }
    }

    if (!staff && !["close"].includes(sub)) {
      return reply(interaction, alert("Staff only", "Only staff can use this action. Members may use `/ticket create` or close their own ticket."));
    }

    try {
      const { channel, doc } = await requireTicketChannel(interaction);

      if (sub === "close") {
        const reason = interaction.options.getString("reason") ?? (staff ? "Closed by staff" : "Closed by opener");
        const res = await svc.closeTicket({
          guild: interaction.guild,
          channel,
          closedById: interaction.user.id,
          reason,
          requesterId: interaction.user.id,
          isStaff: staff,
        });
        return reply(
          interaction,
          res.ok ? ok("Ticket closed", `Ticket **#${res.ticketNumber}** closed. Transcript ${client.queues.heavyQueue ? "queued" : "saved"}.`) : alert("Close", res.message),
        );
      }
      if (sub === "reopen") {
        const res = await svc.reopenTicket(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Reopened", "Ticket is open again.") : alert("Reopen", res.message));
      }
      if (sub === "lock") {
        const res = await svc.lockTicket(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Locked", "Ticket locked.") : alert("Lock", res.message));
      }
      if (sub === "unlock") {
        const res = await svc.unlockTicket(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Unlocked", "Ticket unlocked.") : alert("Unlock", res.message));
      }
      if (sub === "claim") {
        const res = await svc.claimTicket(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Claimed", "You claimed this ticket.") : alert("Claim", res.message));
      }
      if (sub === "unclaim") {
        const res = await svc.unclaimTicket(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Unclaimed", "Claim removed.") : alert("Unclaim", res.message));
      }
      if (sub === "add" || sub === "remove") {
        const user = interaction.options.getUser("user", true);
        const res =
          sub === "add"
            ? await svc.addParticipant(interaction.guild, channel.id, user.id)
            : await svc.removeParticipant(interaction.guild, channel.id, user.id);
        return reply(interaction, res.ok ? ok("Updated", `${sub === "add" ? "Added" : "Removed"} ${user}.`) : alert("Access", res.message));
      }
      if (sub === "transfer") {
        const staffUser = interaction.options.getUser("staff", true);
        const res = await svc.claimTicket(channel, staffUser.id);
        return reply(interaction, res.ok ? ok("Transferred", `Assigned to ${staffUser}.`) : alert("Transfer", res.message));
      }
      if (sub === "escalate") {
        const res = await svc.escalate(channel, interaction.user.id);
        return reply(interaction, res.ok ? ok("Escalated", `Priority is now **${res.priority}**.`) : alert("Escalate", res.message));
      }
      if (sub === "priority") {
        const priority = interaction.options.getString("priority", true) as "low" | "normal" | "high" | "urgent";
        await svc.setPriority(channel.id, priority);
        return reply(interaction, ok("Priority", `Set to **${priority}**.`));
      }
      if (sub === "category") {
        const parent = interaction.options.getChannel("parent", true);
        if ("setParent" in channel) await channel.setParent(parent.id);
        return reply(interaction, ok("Moved", `Ticket moved under **${parent.name}**.`));
      }
      if (sub === "transcript" || sub === "archive") {
        const reason = interaction.options.getString("reason") ?? "Archived by staff";
        if (sub === "archive") {
          await svc.closeTicket({
            guild: interaction.guild,
            channel,
            closedById: interaction.user.id,
            reason,
            requesterId: interaction.user.id,
            isStaff: true,
          });
          return reply(interaction, ok("Archived", "Ticket archived with transcript."));
        }
        if (!client.queues.heavyQueue) {
          await exportTicketTranscript(client, {
            ticketId: String(doc._id),
            channelId: channel.id,
            guildId: interaction.guild.id,
            closedById: interaction.user.id,
            deleteChannel: false,
          });
          return reply(interaction, ok("Transcript", "Transcript posted to log channel (channel kept open)."));
        }
        await svc.enqueueOrRunTranscript({
          ticketId: String(doc._id),
          channelId: channel.id,
          guildId: interaction.guild.id,
          closedById: interaction.user.id,
          deleteChannel: false,
        });
        return reply(interaction, ok("Transcript", "Transcript export queued."));
      }
      if (sub === "delete") {
        const res = await svc.deleteTicket(interaction.guild, channel, interaction.user.id, true);
        return reply(interaction, res.ok ? ok("Deleted", "Ticket deleted.") : alert("Delete", res.message));
      }
      if (sub === "rename") {
        const name = interaction.options.getString("name", true);
        const res = await svc.renameTicket(interaction.guild, channel.id, name);
        return reply(interaction, res.ok ? ok("Renamed", `Channel renamed to **${name}**.`) : alert("Rename", res.message));
      }
      if (sub === "notes") {
        const note = interaction.options.getString("note", true);
        await svc.addNote(channel.id, interaction.user.id, note);
        return reply(interaction, ok("Note saved", "Staff note recorded."));
      }
    } catch (e) {
      return reply(interaction, alert("Ticket", e instanceof Error ? e.message : "Something went wrong."));
    }
  },
};
