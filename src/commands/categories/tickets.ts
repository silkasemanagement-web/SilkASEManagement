import { ChannelType, type SlashCommandStringOption } from "discord.js";
import { TICKET_CATEGORY_KEYS, TICKET_CATEGORY_LABELS, type TicketCategoryKey } from "../../config/constants.js";
import { createCategoryConfigCommand } from "../../core/categoryConfigCommand.js";
import { manageGuildMeta } from "../../core/commandMeta.js";
import { readTickets } from "../../core/guildConfigFields.js";
import { mergeTickets } from "../../core/guildConfigPatch.js";
import { neutral, ok, reply } from "../../core/commandUi.js";

function ticketCategoryOption(option: SlashCommandStringOption) {
  return option
    .setName("category")
    .setDescription("Ticket category")
    .setRequired(false)
    .addChoices(...TICKET_CATEGORY_KEYS.map((key) => ({ name: TICKET_CATEGORY_LABELS[key], value: key })));
}

export const ticketCategoryCommand = createCategoryConfigCommand({
  name: "tickets",
  description: "Ticket system configuration.",
  meta: manageGuildMeta,
  subcommands: [
    { name: "status", description: "Show ticket configuration." },
    {
      name: "category",
      description: "Map a ticket category to a Discord category.",
      configure: (sub) =>
        sub
          .addChannelOption((o) => o.setName("channel").setDescription("Parent category").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
          .addStringOption(ticketCategoryOption),
    },
    {
      name: "roles",
      description: "Set ticket staff role.",
      configure: (sub) => sub.addRoleOption((o) => o.setName("role").setDescription("Support role").setRequired(true)),
    },
    {
      name: "transcripts",
      description: "Set transcript log channel.",
      configure: (sub) =>
        sub.addChannelOption((o) =>
          o.setName("channel").setDescription("Transcript channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        ),
    },
    {
      name: "limits",
      description: "Set max open tickets per user.",
      configure: (sub) => sub.addIntegerOption((o) => o.setName("max").setDescription("Max open tickets").setRequired(true).setMinValue(1).setMaxValue(25)),
    },
    {
      name: "inactivity",
      description: "Set inactive auto-close hours.",
      configure: (sub) => sub.addIntegerOption((o) => o.setName("hours").setDescription("Hours").setRequired(true).setMinValue(1).setMaxValue(8760)),
    },
    {
      name: "ticket-message",
      description: "Set ticket channel welcome message.",
      configure: (sub) => sub.addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true).setMaxLength(2000)),
    },
  ],
  async execute(interaction, sub, client) {
    const cfg = await client.config.getGuild(interaction.guild!.id);
    const tickets = readTickets(cfg);

    if (sub === "status") {
      const raw = tickets.categories as unknown;
      const categories =
        raw instanceof Map
          ? [...raw.entries()].map(([k, v]) => `**${TICKET_CATEGORY_LABELS[k as TicketCategoryKey] ?? k}:** <#${v}>`)
          : Object.entries((raw as Record<string, string> | undefined) ?? {}).map(([k, v]) => `**${TICKET_CATEGORY_LABELS[k as TicketCategoryKey] ?? k}:** <#${v}>`);
      return reply(
        interaction,
        neutral("Ticket configs", "Ticket system settings:", [
          { name: "Categories", value: categories.length ? categories.join("\n") : "None configured", inline: false },
          { name: "Staff roles", value: tickets.staffRoleIds?.length ? tickets.staffRoleIds.map((id) => `<@&${id}>`).join(", ") : "None", inline: false },
          { name: "Transcripts", value: tickets.transcriptLogChannelId ? `<#${tickets.transcriptLogChannelId}>` : "Not set", inline: true },
          { name: "Auto-close hours", value: String(tickets.autoCloseInactiveHours ?? 72), inline: true },
        ]),
      );
    }

    if (sub === "category") {
      const key = (interaction.options.getString("category") ?? "admin_help") as TicketCategoryKey;
      const channel = interaction.options.getChannel("channel", true);
      const current = ((tickets.categories as unknown as Record<string, string> | undefined) ?? {});
      await client.config.updateGuild(interaction.guild!.id, {
        tickets: mergeTickets(tickets, { categories: { ...current, [key]: channel.id } } as never),
      } as never);
      return reply(interaction, ok("Category saved", `${TICKET_CATEGORY_LABELS[key]} → <#${channel.id}>.`));
    }

    if (sub === "roles") {
      const role = interaction.options.getRole("role", true);
      await client.config.updateGuild(interaction.guild!.id, {
        tickets: mergeTickets(tickets, { staffRoleIds: [role.id] }),
      } as never);
      return reply(interaction, ok("Staff role saved", `${role} can support tickets.`));
    }

    if (sub === "transcripts") {
      const channel = interaction.options.getChannel("channel", true);
      await client.config.updateGuild(interaction.guild!.id, {
        tickets: mergeTickets(tickets, { transcriptLogChannelId: channel.id }),
      } as never);
      return reply(interaction, ok("Transcript channel saved", `Transcripts → <#${channel.id}>.`));
    }

    if (sub === "limits") {
      const max = interaction.options.getInteger("max", true);
      await client.config.updateGuild(interaction.guild!.id, {
        tickets: mergeTickets(tickets, { maxOpenPerUser: max }),
      } as never);
      return reply(interaction, ok("Ticket limit saved", `Max open tickets per user: **${max}**.`));
    }

    if (sub === "inactivity") {
      const hours = interaction.options.getInteger("hours", true);
      await client.config.updateGuild(interaction.guild!.id, {
        tickets: mergeTickets(tickets, { autoCloseInactiveHours: hours }),
      } as never);
      return reply(interaction, ok("Inactivity saved", `Auto-close after **${hours}** hours.`));
    }

    const message = interaction.options.getString("message", true);
    await client.config.updateGuild(interaction.guild!.id, {
      tickets: mergeTickets(tickets, { welcomeMessage: message }),
    } as never);
    return reply(interaction, ok("Ticket message saved", "Ticket welcome message updated."));
  },
});
