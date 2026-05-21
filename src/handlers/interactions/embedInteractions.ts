import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { REDIS_PREFIX } from "../../config/constants.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { parseColorHex, sanitizeText, sanitizeUrl } from "../../utils/sanitization.js";

export interface EmbedDraft {
  title?: string;
  description?: string;
  footer?: string;
  color?: number;
  author?: string;
  image?: string;
  thumbnail?: string;
  channelId?: string;
  buttons?: { label: string; url: string }[];
}

function draftKey(guildId: string, userId: string) {
  return `${REDIS_PREFIX.embedDraft}${guildId}:${userId}`;
}

export async function loadDraft(client: ArkBotClient, guildId: string, userId: string) {
  return (await client.cache.getJson<EmbedDraft>(draftKey(guildId, userId))) ?? {};
}

async function saveDraft(client: ArkBotClient, guildId: string, userId: string, draft: EmbedDraft) {
  await client.cache.setJson(draftKey(guildId, userId), draft, 30 * 60);
}

export function buildStudioComponents(channelId?: string) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ae:embed:modal:core")
      .setLabel("Edit core")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ae:embed:modal:media")
      .setLabel("Edit media")
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("ae:embed:channel")
      .setPlaceholder("Select target channel")
      .setMinValues(1)
      .setMaxValues(1)
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ae:embed:preview")
      .setLabel("Preview")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ae:embed:send:${channelId ?? "none"}`)
      .setLabel("Publish")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!channelId),
    new ButtonBuilder().setCustomId("ae:embed:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

export async function openCoreModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId("ae:embed:submit:core").setTitle("Embed core");
  const title = new TextInputBuilder()
    .setCustomId("title")
    .setLabel("Title")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);
  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(4000);
  const footer = new TextInputBuilder()
    .setCustomId("footer")
    .setLabel("Footer")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048);
  const color = new TextInputBuilder()
    .setCustomId("color")
    .setLabel("Color hex (e.g. 2ECC71)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(7);
  const author = new TextInputBuilder()
    .setCustomId("author")
    .setLabel("Author")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(title),
    new ActionRowBuilder<TextInputBuilder>().addComponents(description),
    new ActionRowBuilder<TextInputBuilder>().addComponents(footer),
    new ActionRowBuilder<TextInputBuilder>().addComponents(color),
    new ActionRowBuilder<TextInputBuilder>().addComponents(author),
  );
  await interaction.showModal(modal);
}

export async function openMediaModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId("ae:embed:submit:media").setTitle("Embed media");
  const image = new TextInputBuilder()
    .setCustomId("image")
    .setLabel("Image URL")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(512);
  const thumb = new TextInputBuilder()
    .setCustomId("thumbnail")
    .setLabel("Thumbnail URL")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(512);
  const b1 = new TextInputBuilder()
    .setCustomId("btn1")
    .setLabel("Button 1 label|url (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);
  const b2 = new TextInputBuilder()
    .setCustomId("btn2")
    .setLabel("Button 2 label|url (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(image),
    new ActionRowBuilder<TextInputBuilder>().addComponents(thumb),
    new ActionRowBuilder<TextInputBuilder>().addComponents(b1),
    new ActionRowBuilder<TextInputBuilder>().addComponents(b2),
  );
  await interaction.showModal(modal);
}

export async function handleEmbedModal(client: ArkBotClient, interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;
  const base = await loadDraft(client, interaction.guild.id, interaction.user.id);
  if (interaction.customId === "ae:embed:submit:core") {
    const title = interaction.fields.getTextInputValue("title");
    const description = interaction.fields.getTextInputValue("description");
    const footer = interaction.fields.getTextInputValue("footer");
    const colorRaw = interaction.fields.getTextInputValue("color");
    const author = interaction.fields.getTextInputValue("author");
    const color = parseColorHex(colorRaw);
    await saveDraft(client, interaction.guild.id, interaction.user.id, {
      ...base,
      title: title ? sanitizeText(title, 256) : base.title,
      description: description ? sanitizeText(description, 4000) : base.description,
      footer: footer ? sanitizeText(footer, 2048) : base.footer,
      color: color ?? base.color,
      author: author ? sanitizeText(author, 256) : base.author,
    });
  } else if (interaction.customId === "ae:embed:submit:media") {
    const image = sanitizeUrl(interaction.fields.getTextInputValue("image"));
    const thumbnail = sanitizeUrl(interaction.fields.getTextInputValue("thumbnail"));
    const parseBtn = (raw: string) => {
      const [label, url] = raw.split("|").map((s) => s.trim());
      if (!label || !url) return null;
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return null;
      return { label: sanitizeText(label, 80), url: safeUrl };
    };
    const b1 = parseBtn(interaction.fields.getTextInputValue("btn1"));
    const b2 = parseBtn(interaction.fields.getTextInputValue("btn2"));
    const buttons = [b1, b2].filter(Boolean) as { label: string; url: string }[];
    await saveDraft(client, interaction.guild.id, interaction.user.id, {
      ...base,
      image: image ?? base.image,
      thumbnail: thumbnail ?? base.thumbnail,
      buttons: buttons.length ? buttons : base.buttons,
    });
  }

  const draft = await loadDraft(client, interaction.guild.id, interaction.user.id);
  await interaction.reply({
    ephemeral: true,
    content: "Draft updated.",
    embeds: [buildPreviewEmbed(interaction.client as ArkBotClient, draft)],
    components: buildStudioComponents(draft.channelId),
  });
}

function buildPreviewEmbed(client: ArkBotClient, draft: EmbedDraft) {
  return DynamicEmbedBuilder.build({
    theme: "neutral",
    title: draft.title ?? "Preview",
    description: draft.description ?? "_No description yet._",
    color: draft.color,
    author: draft.author ? { name: draft.author, iconURL: client.user?.displayAvatarURL() } : undefined,
    footer: draft.footer ? { text: draft.footer } : { text: "Embed Studio • Preview" },
    imageURL: draft.image,
    thumbnailURL: draft.thumbnail,
  });
}

export async function handleEmbedButton(client: ArkBotClient, interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const id = interaction.customId;
  if (id === "ae:embed:modal:core") return openCoreModal(interaction);
  if (id === "ae:embed:modal:media") return openMediaModal(interaction);
  if (id === "ae:embed:preview") {
    const draft = await loadDraft(client, interaction.guild.id, interaction.user.id);
    return interaction.reply({
      ephemeral: true,
      embeds: [buildPreviewEmbed(client, draft)],
    });
  }
  if (id.startsWith("ae:embed:send:")) {
    const channelId = id.split(":").pop();
    const draft = await loadDraft(client, interaction.guild.id, interaction.user.id);
    if (!channelId || channelId === "none" || !draft.channelId) {
      return interaction.reply({ ephemeral: true, content: "Select a channel before publishing." });
    }
    const ch = await interaction.guild.channels.fetch(draft.channelId);
    if (!ch?.isTextBased()) {
      return interaction.reply({ ephemeral: true, content: "Invalid channel." });
    }
    const actor = interaction.member;
    if (!actor || !("permissionsIn" in actor)) {
      return interaction.reply({ ephemeral: true, content: "Unable to verify permissions." });
    }
    const perms = actor.permissionsIn(ch);
    if (!perms.has(PermissionFlagsBits.ManageMessages) && !perms.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        ephemeral: true,
        content: "You need **Manage Messages** (or Administrator) in the target channel.",
      });
    }
    const me = interaction.guild.members.me;
    if (!me?.permissionsIn(ch).has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({
        ephemeral: true,
        content: "I need **Send Messages** and **Embed Links** in that channel.",
      });
    }
    const embed = buildPreviewEmbed(client, draft);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    if (draft.buttons?.length) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...draft.buttons.map((b) =>
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url),
        ),
      );
      rows.push(row);
    }
    await ch.send({ embeds: [embed], components: rows });
    await client.cache.del(draftKey(interaction.guild.id, interaction.user.id));
    return interaction.reply({ ephemeral: true, content: `Published to <#${draft.channelId}>.` });
  }
  if (id === "ae:embed:cancel") {
    await client.cache.del(draftKey(interaction.guild.id, interaction.user.id));
    return interaction.update({ content: "Cancelled.", embeds: [], components: [] });
  }
}

export async function handleEmbedChannelSelect(
  client: ArkBotClient,
  interaction: ChannelSelectMenuInteraction,
) {
  if (!interaction.guild) return;
  const draft = await loadDraft(client, interaction.guild.id, interaction.user.id);
  draft.channelId = interaction.values[0]!;
  await saveDraft(client, interaction.guild.id, interaction.user.id, draft);
  await interaction.update({
    embeds: [buildPreviewEmbed(client, draft)],
    components: buildStudioComponents(draft.channelId),
  });
}
