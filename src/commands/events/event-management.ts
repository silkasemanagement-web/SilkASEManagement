import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { BotGameEventModel } from "../../models/BotGameEvent.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

export const eventCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-create")
    .setDescription("Create a persisted bot event (database backed).")
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Event type")
        .setRequired(true)
        .addChoices(
          { name: "number_guess", value: "number_guess" },
          { name: "dino_scramble", value: "dino_scramble" },
          { name: "voice_last_leave", value: "voice_last_leave" },
          { name: "custom", value: "custom" },
        ),
    )
    .addChannelOption((o) => o.setName("channel").setDescription("Host channel").setRequired(true))
    .addStringOption((o) => o.setName("cron").setDescription("Optional cron expression").setMaxLength(64)),
  meta: { requireStaff: true, cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const type = interaction.options.getString("type", true) as "number_guess" | "dino_scramble" | "voice_last_leave" | "custom";
    const channel = interaction.options.getChannel("channel", true);
    const cron = interaction.options.getString("cron");
    await interaction.deferReply({ ephemeral: true });
    const doc = await BotGameEventModel.create({
      guildId: interaction.guild.id,
      type,
      channelId: channel.id,
      status: "scheduled",
      scheduledFor: cron ? new Date(Date.now() + 60_000) : new Date(),
      payload: { cron },
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Event scheduled",
          description: `Stored event **${String(doc._id)}** for <#${channel.id}>.`,
        }),
      ],
    });
  },
};

export const eventStartCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-start")
    .setDescription("Mark an event as running")
    .addStringOption((o) => o.setName("id").setDescription("Mongo event id").setRequired(true)),
  meta: { requireStaff: true, cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const id = interaction.options.getString("id", true);
    await interaction.deferReply({ ephemeral: true });
    await BotGameEventModel.findByIdAndUpdate(id, {
      status: "running",
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 10 * 60_000),
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Event started",
          description: `Event **${id}** is now running (10 minute window).`,
        }),
      ],
    });
  },
};

export const eventStopCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-stop")
    .setDescription("Cancel a running event")
    .addStringOption((o) => o.setName("id").setDescription("Mongo event id").setRequired(true)),
  meta: { requireStaff: true, cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const id = interaction.options.getString("id", true);
    await interaction.deferReply({ ephemeral: true });
    await BotGameEventModel.findByIdAndUpdate(id, { status: "cancelled" });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "alert",
          title: "Event stopped",
          description: `Event **${id}** cancelled.`,
        }),
      ],
    });
  },
};

export const eventListCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("event-list")
    .setDescription("List recent bot events"),
  meta: { requireStaff: true, cooldownMs: 4000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });
    const rows = await BotGameEventModel.find({ guildId: interaction.guild.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Event history",
          description: rows.length
            ? rows.map((r) => `• **${String(r._id)}** • ${r.type} • ${r.status}`).join("\n")
            : "No events yet.",
        }),
      ],
    });
  },
};

export const eventManagementCommands: SlashCommand[] = [
  eventCreateCommand,
  eventStartCommand,
  eventStopCommand,
  eventListCommand,
];
