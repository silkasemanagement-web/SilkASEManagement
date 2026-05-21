import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
  type Role,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { JailRecordModel } from "../../models/JailRecord.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { hierarchyAllows } from "../../utils/discord.js";

const JAIL_ROLE_NAME = "Jail";
const JAIL_CATEGORY_NAME = "📁┃jail";
const JAIL_CHANNEL_NAME = "🔴┃jail";

async function ensureJailSetup(client: ArkBotClient, guild: NonNullable<GuildMember["guild"]>) {
  const cfg = await client.config.getGuild(guild.id);
  let role = cfg.jail?.roleId ? await guild.roles.fetch(cfg.jail.roleId).catch(() => null) : null;
  if (!role) {
    role = guild.roles.cache.find((r) => r.name.toLowerCase() === JAIL_ROLE_NAME.toLowerCase()) ?? null;
  }
  if (!role) {
    role = await guild.roles.create({
      name: JAIL_ROLE_NAME,
      color: 0x2f3136,
      reason: "Jail system setup",
    });
  }

  let category = cfg.jail?.categoryId ? await guild.channels.fetch(cfg.jail.categoryId).catch(() => null) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category =
      guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === JAIL_CATEGORY_NAME) ??
      null;
  }
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = await guild.channels.create({
      name: JAIL_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: "Jail system setup",
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: role.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }

  let channel = cfg.jail?.channelId ? await guild.channels.fetch(cfg.jail.channelId).catch(() => null) : null;
  if (!channel?.isTextBased()) {
    channel =
      guild.channels.cache.find((ch) => ch.type === ChannelType.GuildText && ch.name === JAIL_CHANNEL_NAME) ?? null;
  }
  if (!channel?.isTextBased()) {
    channel = await guild.channels.create({
      name: JAIL_CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: category,
      reason: "Jail system setup",
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });
  }

  await client.config.updateGuild(guild.id, {
    jail: { roleId: role.id, categoryId: category.id, channelId: channel.id },
  } as never);
  return { role, category, channel };
}

async function lockJailRoleOutOfServer(guild: NonNullable<GuildMember["guild"]>, jailRole: Role, jailChannelId: string) {
  await guild.channels.fetch().catch(() => null);
  for (const channel of guild.channels.cache.values()) {
    if (!("permissionOverwrites" in channel)) continue;
    if (channel.id === jailChannelId) {
      await channel.permissionOverwrites.edit(jailRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(() => null);
      continue;
    }
    await channel.permissionOverwrites.edit(jailRole, { ViewChannel: false }).catch(() => null);
  }
}

function removableRoleIds(member: GuildMember) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed)
    .map((role) => role.id);
}

export const jailCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("jail")
    .setDescription("Put a user in jail, strip roles, and restrict them to the jail channel.")
    .addUserOption((option) => option.setName("user").setDescription("User to jail").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(512)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels], cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const client = interaction.client as ArkBotClient;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided.";
    const actor = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!target) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Jail", description: "Member not found." })] });
      return;
    }
    if (!hierarchyAllows(actor, target) || !target.manageable) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Jail", description: "I cannot jail that member because of role hierarchy." })] });
      return;
    }

    const setup = await ensureJailSetup(client, interaction.guild);
    if (!setup.role.editable) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Jail", description: "Move my bot role above the Jail role, then try again." })] });
      return;
    }
    await lockJailRoleOutOfServer(interaction.guild, setup.role, setup.channel.id);
    const previousRoleIds = removableRoleIds(target).filter((roleId) => roleId !== setup.role.id);
    await target.roles.set([setup.role.id], `Jailed by ${interaction.user.tag}: ${reason}`);
    await JailRecordModel.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: target.id, status: "jailed" },
      {
        $set: {
          usernameSnapshot: target.user.tag,
          jailRoleId: setup.role.id,
          jailChannelId: setup.channel.id,
          previousRoleIds,
          jailedById: interaction.user.id,
          reason,
        },
      },
      { upsert: true, new: true },
    );

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Member jailed",
          description: `<@${target.id}> is now jailed in <#${setup.channel.id}>.`,
          fields: [{ name: "Reason", value: reason }],
        }),
      ],
    });
  },
};

export const unjailCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Release a user from jail and restore their previous roles.")
    .addUserOption((option) => option.setName("user").setDescription("User to unjail").setRequired(true)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels], cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    const record = await JailRecordModel.findOne({ guildId: interaction.guild.id, userId: user.id, status: "jailed" });
    if (!target || !record) {
      await interaction.editReply({ embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Unjail", description: "Active jail record not found." })] });
      return;
    }

    const roleIds = record.previousRoleIds.filter((roleId) => interaction.guild!.roles.cache.has(roleId));
    await target.roles.set(roleIds, `Unjailed by ${interaction.user.tag}`);
    record.status = "released";
    record.unjailedById = interaction.user.id;
    record.releasedAt = new Date();
    await record.save();

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Member unjailed",
          description: `<@${target.id}> has been released and previous roles were restored when possible.`,
        }),
      ],
    });
  },
};
