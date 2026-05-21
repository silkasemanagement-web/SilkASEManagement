import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { PollModel } from "../../models/Poll.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { interactionTextChannel } from "../../utils/textChannel.js";

const POLL_REACTIONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];
const SILK_RED = 0xff0033;

export const pollCreateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("poll-create")
    .setDescription("Create a reaction poll from newline-separated options.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName("question").setDescription("Poll question").setRequired(true).setMaxLength(200),
    )
    .addStringOption((o) =>
      o
        .setName("options")
        .setDescription("One poll option per line. Up to 20 options can receive reaction voting.")
        .setRequired(true)
        .setMaxLength(3000),
    ),
  meta: { cooldownMs: 10_000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const tc = interactionTextChannel(interaction);
    if (!tc) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Poll",
            description: "Use this command in a server text channel.",
          }),
        ],
      });
      return;
    }
    const question = interaction.options.getString("question", true);
    const options = interaction.options
      .getString("options", true)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, POLL_REACTIONS.length)
      .map((label, index) => ({ id: String(index + 1), label: label.slice(0, 100), emoji: POLL_REACTIONS[index]! }));
    if (options.length < 2) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Poll", description: "Please provide at least 2 options, one per line." })],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(SILK_RED)
      .setTitle(question)
      .setDescription(options.map((o) => `${o.emoji} ${o.label}`).join("\n"))
      .setFooter({ text: "React below to vote." })
      .setTimestamp(new Date());
    const msg = await tc.send({ embeds: [embed] });
    for (const option of options) await msg.react(option.emoji).catch(() => null);
    await PollModel.create({
      guildId: interaction.guild.id,
      channelId: tc.id,
      messageId: msg.id,
      creatorId: interaction.user.id,
      question,
      options,
      mode: "reactions",
      anonymous: false,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Poll posted",
          description: `[Jump](${msg.url})`,
        }),
      ],
    });
  },
};

export const pollEndCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("poll-end")
    .setDescription("Close a reaction poll by message ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName("message_id").setDescription("Poll message ID").setRequired(true).setMaxLength(25)),
  meta: { cooldownMs: 5000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const messageId = interaction.options.getString("message_id", true);
    const doc = await PollModel.findOneAndUpdate({ messageId }, { $set: { status: "closed" } }, { new: true });
    if (!doc) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Poll end", description: "Poll was not found." })] });
      return;
    }
    await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Poll closed", description: `Closed poll **${doc.question}**.` })] });
  },
};
