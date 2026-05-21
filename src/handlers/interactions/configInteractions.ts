import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIEmbedField,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ModalSubmitInteraction,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { buildConfigMenu } from "../../commands/config/config.js";
import type { GuildConfigurationDocument } from "../../models/GuildConfiguration.js";
import { TICKET_CATEGORY_KEYS, TICKET_CATEGORY_LABELS } from "../../config/constants.js";

type ConfigFieldKind = "channel" | "roleList" | "boolean" | "number" | "text";
type ConfigField = {
  section: string;
  key: string;
  label: string;
  description?: string;
  kind: ConfigFieldKind;
  channelTypes?: ChannelType[];
  min?: number;
  max?: number;
};

const textChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const categoryChannelTypes = [ChannelType.GuildCategory];

const CONFIG_FIELDS: ConfigField[] = [
  { section: "staff_roles", key: "staffRoleIds", label: "Staff roles", kind: "roleList" },
  { section: "staff_roles", key: "adminRoleIds", label: "Admin roles", kind: "roleList" },
  { section: "staff_roles", key: "helperRoleIds", label: "Helper roles", kind: "roleList" },
  { section: "staff_roles", key: "eventManagerRoleIds", label: "Event manager roles", kind: "roleList" },
  { section: "staff_roles", key: "alertRoleIds", label: "Alert roles", kind: "roleList" },

  { section: "logging", key: "modLogChannelId", label: "Moderation log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "auditLogChannelId", label: "Audit mirror", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.messageDeleteChannelId", label: "Message delete log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.messageEditChannelId", label: "Message edit log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.memberJoinChannelId", label: "Member join log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.memberLeaveChannelId", label: "Member leave log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.voiceChannelId", label: "Voice log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.roleChannelId", label: "Role log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.channelChannelId", label: "Channel log", kind: "channel", channelTypes: textChannelTypes },
  { section: "logging", key: "logging.nicknameChannelId", label: "Nickname log", kind: "channel", channelTypes: textChannelTypes },

  { section: "automod", key: "automod.enabled", label: "Automod enabled", kind: "boolean" },
  { section: "automod", key: "automod.antiSpam", label: "Anti spam", kind: "boolean" },
  { section: "automod", key: "automod.spamThreshold", label: "Spam threshold", kind: "number", min: 1, max: 50 },
  { section: "automod", key: "automod.spamIntervalMs", label: "Spam interval ms", kind: "number", min: 1000, max: 60000 },
  { section: "automod", key: "automod.antiRaid", label: "Anti raid", kind: "boolean" },
  { section: "automod", key: "automod.raidJoinsPer10s", label: "Raid joins per 10s", kind: "number", min: 1, max: 100 },
  { section: "automod", key: "automod.antiMassMention", label: "Anti mass mention", kind: "boolean" },
  { section: "automod", key: "automod.massMentionThreshold", label: "Mass mention threshold", kind: "number", min: 1, max: 50 },
  { section: "automod", key: "automod.antiScamLinks", label: "Anti scam links", kind: "boolean" },
  { section: "automod", key: "automod.antiInvites", label: "Anti invites", kind: "boolean" },
  { section: "automod", key: "automod.antiGhostPing", label: "Anti ghost ping", kind: "boolean" },
  { section: "automod", key: "automod.autoTimeoutMinutes", label: "Auto timeout minutes", kind: "number", min: 1, max: 10080 },
  { section: "automod", key: "automod.warnEscalation", label: "Warn escalation", kind: "boolean" },

  { section: "tickets", key: "tickets.panelChannelId", label: "Ticket panel channel", kind: "channel", channelTypes: textChannelTypes },
  { section: "tickets", key: "tickets.transcriptLogChannelId", label: "Transcript log channel", kind: "channel", channelTypes: textChannelTypes },
  { section: "tickets", key: "tickets.staffRoleIds", label: "Ticket staff roles", kind: "roleList" },
  { section: "tickets", key: "tickets.autoCloseInactiveHours", label: "Auto close inactive hours", kind: "number", min: 1, max: 8760 },
  ...TICKET_CATEGORY_KEYS.map((key) => ({
    section: "tickets",
    key: `tickets.categories.${key}`,
    label: `${TICKET_CATEGORY_LABELS[key]} category`,
    kind: "channel" as const,
    channelTypes: categoryChannelTypes,
  })),

  { section: "suggestions", key: "suggestions.channelId", label: "Suggestions channel", kind: "channel", channelTypes: textChannelTypes },
  { section: "suggestions", key: "suggestions.anonymousAllowed", label: "Anonymous allowed", kind: "boolean" },
  { section: "suggestions", key: "suggestions.threadPerSuggestion", label: "Thread per suggestion", kind: "boolean" },

  { section: "scheduling", key: "scheduling.arkRestartCron", label: "ARK restart cron", kind: "text" },
  { section: "scheduling", key: "scheduling.wipeAnnounceCron", label: "Wipe announce cron", kind: "text" },
  { section: "scheduling", key: "scheduling.donationReminderCron", label: "Donation reminder cron", kind: "text" },
  { section: "scheduling", key: "scheduling.eventNumberCron", label: "Number event cron", kind: "text" },
  { section: "scheduling", key: "scheduling.eventDinoCron", label: "Dino event cron", kind: "text" },
  { section: "scheduling", key: "events.miniGameChannelId", label: "Mini-game channel", kind: "channel", channelTypes: textChannelTypes },
  { section: "scheduling", key: "events.eventChannelId", label: "Event channel", kind: "channel", channelTypes: textChannelTypes },
  { section: "scheduling", key: "events.defaultNumberReward", label: "Default number reward", kind: "text" },
  { section: "scheduling", key: "events.defaultDinoReward", label: "Default dino reward", kind: "text" },
];

function fieldsForSection(section: string) {
  return CONFIG_FIELDS.filter((field) => field.section === section);
}

function fieldByKey(key: string) {
  return CONFIG_FIELDS.find((field) => field.key === key);
}

function fieldIndex(field: ConfigField) {
  return fieldsForSection(field.section).findIndex((candidate) => candidate.key === field.key);
}

function fieldAtOffset(field: ConfigField, offset: number) {
  const fields = fieldsForSection(field.section);
  const index = fieldIndex(field);
  if (index < 0 || !fields.length) return field;
  return fields[(index + offset + fields.length) % fields.length];
}

function valueAt(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current instanceof Map) return current.get(part);
    if (current && typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

function formatValue(cfg: GuildConfigurationDocument, field: ConfigField) {
  const value = valueAt(cfg, field.key);
  if (field.kind === "channel") return typeof value === "string" && value ? `<#${value}>` : "_Not set_";
  if (field.kind === "roleList") {
    return Array.isArray(value) && value.length ? value.map((id) => `<@&${id}>`).join(", ") : "_None_";
  }
  if (field.kind === "boolean") return value ? "On" : "Off";
  return value === undefined || value === null || value === "" ? "_Not set_" : String(value);
}

function buildSectionEmbed(section: string, cfg: GuildConfigurationDocument, updated?: ConfigField) {
  const fields = fieldsForSection(section).map<APIEmbedField>((field) => ({
    name: field.label,
    value: formatValue(cfg, field),
    inline: true,
  }));

  return DynamicEmbedBuilder.build({
    theme: updated ? "ark" : "neutral",
    title: `Configuration • ${section}`,
    description: updated
      ? `Updated **${updated.label}**. Choose another setting below.`
      : "Choose a setting below, then use the editor that appears to change it.",
    fields,
  });
}

function buildFieldEmbed(field: ConfigField, cfg: GuildConfigurationDocument, updated = false) {
  const currentIndex = fieldIndex(field) + 1;
  const total = fieldsForSection(field.section).length;
  return DynamicEmbedBuilder.build({
    theme: updated ? "ark" : "neutral",
    title: `Configuration • ${field.label}`,
    description: updated
      ? `Updated **${field.label}**. You can edit it again, move to the next option, go back, or exit.`
      : "Review this option, then edit it here or move through the options with the buttons.",
    fields: [
      { name: "Current value", value: formatValue(cfg, field) },
      { name: "Section", value: field.section, inline: true },
      { name: "Option", value: `${currentIndex}/${total}`, inline: true },
      { name: "Editor", value: editorDescription(field), inline: true },
    ],
  });
}

function buildSettingMenu(section: string, selectedKey?: string) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ae:config:setting:${section}`)
    .setPlaceholder("Choose a setting to change")
    .addOptions(
      fieldsForSection(section).map((field) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(field.label)
          .setDescription(field.description ?? editorDescription(field))
          .setValue(field.key)
          .setDefault(selectedKey === field.key),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function editorDescription(field: ConfigField) {
  switch (field.kind) {
    case "channel":
      return "Select a Discord channel";
    case "roleList":
      return "Select one or more roles";
    case "boolean":
      return "Turn this option on or off";
    case "number":
      return "Enter a number";
    case "text":
      return "Enter text";
  }
}

function buildEditorRow(field: ConfigField) {
  if (field.kind === "channel") {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`ae:config:channel:${field.key}`)
      .setPlaceholder(`Set ${field.label}`)
      .setMinValues(0)
      .setMaxValues(1);
    if (field.channelTypes?.length) menu.addChannelTypes(...field.channelTypes);
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu);
  }

  if (field.kind === "roleList") {
    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`ae:config:roles:${field.key}`)
        .setPlaceholder(`Set ${field.label}`)
        .setMinValues(0)
        .setMaxValues(25),
    );
  }

  if (field.kind === "boolean") {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ae:config:boolean:${field.key}`)
        .setPlaceholder(`Set ${field.label}`)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("On").setValue("true"),
          new StringSelectMenuOptionBuilder().setLabel("Off").setValue("false"),
        ),
    );
  }

  return null;
}

function buildSectionNavRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ae:config:root")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ae:config:exit")
      .setLabel("Exit")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildFieldNavRow(field: ConfigField) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ae:config:back:${field.section}`)
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ae:config:prev:${field.key}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ae:config:next:${field.key}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Primary),
  );

  if (field.kind === "number" || field.kind === "text") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ae:config:edit:${field.key}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Success),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("ae:config:exit")
      .setLabel("Exit")
      .setStyle(ButtonStyle.Danger),
  );
  return row;
}

function buildSectionComponents(section: string, selectedKey?: string) {
  const components: ActionRowBuilder<StringSelectMenuBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder | ButtonBuilder>[] = [
    buildConfigMenu(section),
    buildSettingMenu(section, selectedKey),
  ];
  components.push(buildSectionNavRow());
  return components;
}

function buildFieldComponents(field: ConfigField) {
  const components: ActionRowBuilder<StringSelectMenuBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder | ButtonBuilder>[] = [
    buildSettingMenu(field.section, field.key),
    buildFieldNavRow(field),
  ];
  const editor = buildEditorRow(field);
  if (editor) components.push(editor);
  return components;
}

function buildPatch(field: ConfigField, value: unknown): Partial<GuildConfigurationDocument> {
  return { [field.key]: value } as Partial<GuildConfigurationDocument>;
}

async function updateConfigValue(client: ArkBotClient, guildId: string, field: ConfigField, value: unknown) {
  return client.config.updateGuild(guildId, buildPatch(field, value));
}

async function editPanel(
  interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction | ButtonInteraction,
  section: string,
  cfg: GuildConfigurationDocument,
  updatedField?: ConfigField,
) {
  await interaction.editReply({
    embeds: [buildSectionEmbed(section, cfg, updatedField)],
    components: buildSectionComponents(section, updatedField?.key),
  });
}

async function editFieldPanel(
  interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction | ButtonInteraction,
  field: ConfigField,
  cfg: GuildConfigurationDocument,
  updated = false,
) {
  await interaction.editReply({
    embeds: [buildFieldEmbed(field, cfg, updated)],
    components: buildFieldComponents(field),
  });
}

async function showTextModal(interaction: StringSelectMenuInteraction | ButtonInteraction, cfg: GuildConfigurationDocument, field: ConfigField) {
  const current = formatValue(cfg, field).replace(/^_Not set_$/, "");
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(field.label.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256)
    .setValue(current.slice(0, 256));

  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`ae:config:text:${field.key}`)
      .setTitle(`Set ${field.label}`.slice(0, 45))
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)),
  );
}

export async function handleConfigSectionSelect(client: ArkBotClient, interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;
  await interaction.deferUpdate().catch(() => null);
  const section = interaction.values[0];
  const cfg = await client.config.getGuild(interaction.guild.id);
  const fields = fieldsForSection(section);
  if (fields.length === 1) {
    await editFieldPanel(interaction, fields[0], cfg);
    return;
  }
  await editPanel(interaction, section, cfg);
}

export async function handleConfigSettingSelect(client: ArkBotClient, interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;
  const field = fieldByKey(interaction.values[0]);
  if (!field) {
    await interaction.reply({ ephemeral: true, content: "Unknown configuration setting." }).catch(() => null);
    return;
  }

  await interaction.deferUpdate().catch(() => null);
  const cfg = await client.config.getGuild(interaction.guild.id);
  await editFieldPanel(interaction, field, cfg);
}

export async function handleConfigChannelSelect(client: ArkBotClient, interaction: ChannelSelectMenuInteraction) {
  if (!interaction.guild) return;
  await interaction.deferUpdate().catch(() => null);
  const field = fieldByKey(interaction.customId.replace("ae:config:channel:", ""));
  if (!field || field.kind !== "channel") return;
  const next = await updateConfigValue(client, interaction.guild.id, field, interaction.values[0] || undefined);
  await editFieldPanel(interaction, field, next, true);
}

export async function handleConfigRoleSelect(client: ArkBotClient, interaction: RoleSelectMenuInteraction) {
  if (!interaction.guild) return;
  await interaction.deferUpdate().catch(() => null);
  const field = fieldByKey(interaction.customId.replace("ae:config:roles:", ""));
  if (!field || field.kind !== "roleList") return;
  const next = await updateConfigValue(client, interaction.guild.id, field, interaction.values);
  await editFieldPanel(interaction, field, next, true);
}

export async function handleConfigBooleanSelect(client: ArkBotClient, interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;
  await interaction.deferUpdate().catch(() => null);
  const field = fieldByKey(interaction.customId.replace("ae:config:boolean:", ""));
  if (!field || field.kind !== "boolean") return;
  const next = await updateConfigValue(client, interaction.guild.id, field, interaction.values[0] === "true");
  await editFieldPanel(interaction, field, next, true);
}

export async function handleConfigButton(client: ArkBotClient, interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  if (interaction.customId === "ae:config:exit") {
    await interaction.update({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Configuration closed",
          description: "Run `/config` again whenever you need to change settings.",
        }),
      ],
      components: [],
    });
    return;
  }

  if (interaction.customId.startsWith("ae:config:edit:")) {
    const field = fieldByKey(interaction.customId.replace("ae:config:edit:", ""));
    if (!field || (field.kind !== "number" && field.kind !== "text")) return;
    const cfg = await client.config.getGuild(interaction.guild.id);
    await showTextModal(interaction, cfg, field);
    return;
  }

  await interaction.deferUpdate().catch(() => null);
  const cfg = await client.config.getGuild(interaction.guild.id);

  if (interaction.customId === "ae:config:root") {
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "SILK™ ASE PS4/PS5 configuration",
          description: "Choose a configuration section to view and edit.",
        }),
      ],
      components: [buildConfigMenu()],
    });
    return;
  }

  if (interaction.customId.startsWith("ae:config:back:")) {
    const section = interaction.customId.replace("ae:config:back:", "");
    await editPanel(interaction, section, cfg);
    return;
  }

  if (interaction.customId.startsWith("ae:config:prev:") || interaction.customId.startsWith("ae:config:next:")) {
    const isNext = interaction.customId.startsWith("ae:config:next:");
    const key = interaction.customId.replace(isNext ? "ae:config:next:" : "ae:config:prev:", "");
    const field = fieldByKey(key);
    if (!field) return;
    await editFieldPanel(interaction, fieldAtOffset(field, isNext ? 1 : -1), cfg);
    return;
  }

}

export async function handleConfigTextModal(client: ArkBotClient, interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;
  const field = fieldByKey(interaction.customId.replace("ae:config:text:", ""));
  if (!field || (field.kind !== "number" && field.kind !== "text")) {
    await interaction.reply({ ephemeral: true, content: "Unknown configuration setting." }).catch(() => null);
    return;
  }

  const raw = interaction.fields.getTextInputValue("value").trim();
  let value: string | number | undefined = raw || undefined;
  if (field.kind === "number" && value !== undefined) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || (field.min !== undefined && parsed < field.min) || (field.max !== undefined && parsed > field.max)) {
      await interaction.reply({
        ephemeral: true,
        content: `Enter a valid number${field.min !== undefined ? ` from ${field.min}` : ""}${field.max !== undefined ? ` to ${field.max}` : ""}.`,
      });
      return;
    }
    value = parsed;
  }

  const next = await updateConfigValue(client, interaction.guild.id, field, value);
  const payload = {
    embeds: [buildFieldEmbed(field, next, true)],
    components: buildFieldComponents(field),
  };

  if (interaction.isFromMessage()) {
    await interaction.update(payload);
    return;
  }

  await interaction.reply({ ephemeral: true, ...payload });
}
