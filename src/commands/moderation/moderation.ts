import {
  type Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import type { ArkBotClient } from "../../client/ArkBotClient.js";
import { ModerationService } from "../../services/ModerationService.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";
import { interactionTextChannel } from "../../utils/textChannel.js";
import { hierarchyAllows } from "../../utils/discord.js";
import { ModerationLogModel } from "../../models/ModerationLog.js";
import { WarningModel } from "../../models/Warning.js";
import { massRoleApply, type MassRoleProgress } from "../../workers/heavyJobProcessor.js";

const modPerms = [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers];
const PROGRESS_BAR_SIZE = 20;

function serviceFromInteraction(interaction: { client: import("discord.js").Client }) {
  return new ModerationService((interaction.client as import("../../client/ArkBotClient.js").ArkBotClient).log);
}

async function ensureHierarchy(interaction: import("discord.js").ChatInputCommandInteraction, targetId: string) {
  const guild = interaction.guild;
  const actor = await guild!.members.fetch(interaction.user.id);
  const target = await guild!.members.fetch(targetId).catch(() => null);
  if (!target) return { ok: false as const, message: "Member not found." };
  if (!hierarchyAllows(actor, target)) return { ok: false as const, message: "You cannot act on this member." };
  return { ok: true as const, actor, target };
}

function massRoleProgressBar(progress: MassRoleProgress) {
  if (progress.total === 0) return "[--------------------] 0%";
  const filled = Math.round((progress.processed / progress.total) * PROGRESS_BAR_SIZE);
  return `[${"#".repeat(filled)}${"-".repeat(PROGRESS_BAR_SIZE - filled)}] ${Math.floor(
    (progress.processed / progress.total) * 100,
  )}%`;
}

function massRoleDescription(roleMention: string, action: "add" | "remove", progress: MassRoleProgress) {
  return (
    `Role: ${roleMention}\n` +
    `Action: **${action}**\n\n` +
    `Progress: \`${massRoleProgressBar(progress)}\`\n` +
    `Checked: **${progress.processed}/${progress.total}** users\n` +
    `Updated: **${progress.ok}**\n` +
    `Already correct/skipped: **${progress.skipped}**\n` +
    `Failed: **${progress.fail}**`
  );
}

async function sendOrEditMassRoleProgress(
  interaction: import("discord.js").ChatInputCommandInteraction,
  message: Message | null,
  payload: { embeds: ReturnType<typeof DynamicEmbedBuilder.build>[] },
) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => null);
    return message;
  }

  if (message) {
    await message.edit(payload).catch(() => null);
    return message;
  }

  if (interaction.channel?.isTextBased() && "send" in interaction.channel) {
    return interaction.channel.send(payload).catch(() => null);
  }

  return null;
}

export const banCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member with database logging and evidence support.")
    .addUserOption((o) => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(512))
    .addIntegerOption((o) =>
      o.setName("delete_days").setDescription("Delete recent messages (days)").setMinValue(0).setMaxValue(7),
    ),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.BanMembers], cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    const svc = serviceFromInteraction(interaction);
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
    const check = await ensureHierarchy(interaction, user.id);
    if (!check.ok) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Ban", description: check.message })],
      });
      return;
    }
    const res = await svc.ban({
      interaction: interaction as never,
      target: user,
      reason,
      deleteMessageSeconds: Math.min(deleteDays * 86_400, 604_800),
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: res.ok ? "ark" : "alert",
          title: "Ban",
          description: res.ok ? `Case **${res.caseId}** • Banned <@${user.id}>` : res.message,
          fields: reason ? [{ name: "Reason", value: reason }] : [],
        }),
      ],
    });
  },
};

export const kickCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member.")
    .addUserOption((o) => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(512)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.KickMembers], cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const svc = serviceFromInteraction(interaction);
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!target) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Kick", description: "Member not in server." })],
      });
      return;
    }
    const check = await ensureHierarchy(interaction, user.id);
    if (!check.ok) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Kick", description: check.message })],
      });
      return;
    }
    const res = await svc.kick({ interaction: interaction as never, target, reason });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: res.ok ? "ark" : "alert",
          title: "Kick",
          description: res.ok ? `Case **${res.caseId}** • Kicked <@${user.id}>` : res.message,
        }),
      ],
    });
  },
};

export const timeoutCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member (Discord native).")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(512)),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const svc = serviceFromInteraction(interaction);
    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!target) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({ theme: "alert", title: "Timeout", description: "Member not in server." }),
        ],
      });
      return;
    }
    const check = await ensureHierarchy(interaction, user.id);
    if (!check.ok) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({ theme: "alert", title: "Timeout", description: check.message }),
        ],
      });
      return;
    }
    const res = await svc.timeout({
      interaction: interaction as never,
      target,
      durationMs: minutes * 60_000,
      reason,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: res.ok ? "ark" : "alert",
          title: "Timeout",
          description: res.ok
            ? `Case **${res.caseId}** • <@${user.id}> timed out for **${minutes}m**`
            : res.message,
          fields: reason ? [{ name: "Reason", value: reason }] : [],
        }),
      ],
    });
  },
};

export const warnCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a structured warning.")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(900))
    .addIntegerOption((o) => o.setName("weight").setDescription("Weight 1-5").setMinValue(1).setMaxValue(5)),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const svc = serviceFromInteraction(interaction);
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const weight = interaction.options.getInteger("weight") ?? 1;
    const check = await ensureHierarchy(interaction, user.id);
    if (!check.ok) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Warn", description: check.message })],
      });
      return;
    }
    const res = await svc.warn({
      interaction: interaction as never,
      targetId: user.id,
      reason,
      weight,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Warning issued",
          description: `Case **${res.caseId}** • <@${user.id}>`,
          fields: [
            { name: "Reason", value: reason },
            { name: "Weight", value: String(weight), inline: true },
          ],
        }),
      ],
    });
  },
};

export const muteCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute via timeout (alias).")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(512)),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const svc = serviceFromInteraction(interaction);
    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!target) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({ theme: "alert", title: "Mute", description: "Member not in server." }),
        ],
      });
      return;
    }
    const check = await ensureHierarchy(interaction, user.id);
    if (!check.ok) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Mute", description: check.message })],
      });
      return;
    }
    const res = await svc.timeout({
      interaction: interaction as never,
      target,
      durationMs: minutes * 60_000,
      reason,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: res.ok ? "ark" : "alert",
          title: "Mute (timeout)",
          description: res.ok
            ? `Case **${res.caseId}** • <@${user.id}> muted for **${minutes}m**`
            : res.message,
          fields: reason ? [{ name: "Reason", value: reason }] : [],
        }),
      ],
    });
  },
};

export const unmuteCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout.")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!target?.moderatable) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Unmute", description: "Cannot modify member." })],
      });
      return;
    }
    await target.timeout(null);
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Unmute",
          description: `Removed timeout for <@${user.id}>`,
        }),
      ],
    });
  },
};

export const purgeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete recent messages.")
    .addIntegerOption((o) => o.setName("amount").setDescription("1-100").setRequired(true).setMinValue(1).setMaxValue(100))
    .addChannelOption((o) => o.setName("channel").setDescription("Channel (defaults to current)")),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageMessages], cooldownMs: 5000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const svc = serviceFromInteraction(interaction);
    const amount = interaction.options.getInteger("amount", true);
    const channel = interaction.options.getChannel("channel");
    const res = await svc.purge({
      interaction: interaction as never,
      amount,
      channelId: channel?.id,
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: res.ok ? "ark" : "alert",
          title: "Purge",
          description: res.ok ? `Deleted **${res.count}** messages.` : res.message,
        }),
      ],
    });
  },
};

export const slowmodeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Channel slowmode")
    .addIntegerOption((o) => o.setName("seconds").setDescription("0 disables").setRequired(true).setMinValue(0).setMaxValue(21600)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageChannels], cooldownMs: 4000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const tc = interactionTextChannel(interaction);
    if (!tc) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Slowmode",
            description: "Use this command in a text channel.",
          }),
        ],
      });
      return;
    }
    const seconds = interaction.options.getInteger("seconds", true);
    await tc.setRateLimitPerUser(seconds);
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Slowmode",
          description: seconds === 0 ? "Slowmode **disabled**." : `Set to **${seconds}s** per user.`,
        }),
      ],
    });
  },
};

export const lockCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock channel for @everyone")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(false)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageChannels], cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const raw = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!raw) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Lock", description: "Invalid channel." })],
      });
      return;
    }
    const ch = await interaction.guild.channels.fetch(raw.id);
    if (!ch?.isTextBased() || !("permissionOverwrites" in ch)) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Lock", description: "Invalid channel." })],
      });
      return;
    }
    await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.editReply({
      embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Locked", description: `<#${ch.id}> locked.` })],
    });
  },
};

export const unlockCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock channel for @everyone")
    .addChannelOption((o) => o.setName("channel").setDescription("Channel").setRequired(false)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageChannels], cooldownMs: 3000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const raw = interaction.options.getChannel("channel") ?? interaction.channel;
    if (!raw) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Unlock", description: "Invalid channel." })],
      });
      return;
    }
    const ch = await interaction.guild.channels.fetch(raw.id);
    if (!ch?.isTextBased() || !("permissionOverwrites" in ch)) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Unlock", description: "Invalid channel." })],
      });
      return;
    }
    await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.editReply({
      embeds: [DynamicEmbedBuilder.build({ theme: "ark", title: "Unlocked", description: `<#${ch.id}> unlocked.` })],
    });
  },
};

export const nicknameCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Change a member nickname")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption((o) => o.setName("name").setDescription("New nickname (empty to reset)").setMaxLength(32)),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageNicknames], cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const name = interaction.options.getString("name");
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Nickname", description: "Member not found." })],
      });
      return;
    }
    await member.setNickname(name && name.length ? name : null);
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Nickname updated",
          description: `<@${user.id}> → **${name ?? "reset"}**`,
        }),
      ],
    });
  },
};

export const roleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("add or remove")
        .setRequired(true)
        .addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
        ),
    ),
  meta: { deferReply: false, requiredDiscordPermissions: [PermissionFlagsBits.ManageRoles], cooldownMs: 2000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const roleRaw = interaction.options.getRole("role", true);
    const role = await interaction.guild.roles.fetch(roleRaw.id);
    if (!role) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Role", description: "Role not found." })],
      });
      return;
    }
    const action = interaction.options.getString("action", true) as "add" | "remove";
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply({
        embeds: [DynamicEmbedBuilder.build({ theme: "alert", title: "Role", description: "Member not found." })],
      });
      return;
    }
    if (action === "add") await member.roles.add(role, `/${interaction.commandName}`);
    else await member.roles.remove(role, `/${interaction.commandName}`);
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Role updated",
          description: `${action === "add" ? "Added" : "Removed"} ${role} for <@${user.id}>`,
        }),
      ],
    });
  },
};

export const massroleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("massrole")
    .setDescription("Add/remove a role for all non-bot members with live progress.")
    .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("add or remove")
        .setRequired(true)
        .addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
        ),
    ),
  meta: {
    requiredDiscordPermissions: [PermissionFlagsBits.Administrator],
    cooldownMs: 60_000,
    deferReply: true,
    deferEphemeral: false,
  },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => null);
    }
    const roleRaw = interaction.options.getRole("role", true);
    const role = await interaction.guild.roles.fetch(roleRaw.id);
    if (!role) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({ theme: "alert", title: "Mass role", description: "Role not found." }),
        ],
      });
      return;
    }
    if (role.managed || role.id === interaction.guild.id) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Mass role",
            description: "I cannot mass-assign managed roles or the @everyone role.",
          }),
        ],
      });
      return;
    }
    if (!role.editable) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Mass role",
            description: "I cannot manage that role. Move the bot role above it, then try again.",
          }),
        ],
      });
      return;
    }
    const action = interaction.options.getString("action", true) as "add" | "remove";
    const client = interaction.client as ArkBotClient;
    const payload = {
      guildId: interaction.guild.id,
      roleId: role.id,
      action,
      moderatorId: interaction.user.id,
    };
    const startingProgress: MassRoleProgress = { ok: 0, fail: 0, skipped: 0, total: 0, processed: 0 };
    let progressMessage: Message | null = null;

    progressMessage = await sendOrEditMassRoleProgress(interaction, progressMessage, {
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: "Starting mass role",
          description:
            `${action === "add" ? "Giving" : "Removing"} ${role} ${
              action === "add" ? "to" : "from"
            } all non-bot members now.\n\n` + massRoleDescription(`${role}`, action, startingProgress),
        }),
      ],
    });

    const result = await massRoleApply(client, payload, async (progress) => {
      progressMessage = await sendOrEditMassRoleProgress(interaction, progressMessage, {
        embeds: [
          DynamicEmbedBuilder.build({
            theme: progress.fail ? "alert" : "ark",
            title: "Mass role in progress",
            description: massRoleDescription(`${role}`, action, progress),
          }),
        ],
      });
    });

    await sendOrEditMassRoleProgress(interaction, progressMessage, {
      embeds: [
        DynamicEmbedBuilder.build({
          theme: result.fail ? "alert" : "ark",
          title: "Mass role complete",
          description:
            `${action === "add" ? "Finished giving" : "Finished removing"} ${role} ${
              action === "add" ? "to" : "from"
            } all eligible non-bot members.\n\n` + massRoleDescription(`${role}`, action, result),
        }),
      ],
    });
  },
};

export const modlogsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("Show recent moderation cases")
    .addUserOption((o) => o.setName("user").setDescription("Filter by user")),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 4000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user");
    const query = user
      ? { guildId: interaction.guild.id, targetId: user.id }
      : { guildId: interaction.guild.id };
    const rows = await ModerationLogModel.find(query).sort({ createdAt: -1 }).limit(10).lean();
    const lines = rows.map((r) => {
      const created = r.createdAt ? new Date(r.createdAt as Date) : new Date();
      return `**${r.caseId}** • ${r.action} • <@${r.targetId ?? "unknown"}> • ${time(created, TimestampStyles.ShortDateTime)}`;
    });
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: "Moderation logs",
          description: lines.length ? lines.join("\n") : "No records.",
        }),
      ],
    });
  },
};

export const historyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Punishment history for a user")
    .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)),
  meta: { deferReply: false, requiredDiscordPermissions: modPerms, cooldownMs: 4000 },
  async execute(interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user", true);
    const warns = await WarningModel.find({ guildId: interaction.guild.id, userId: user.id })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    const logs = await ModerationLogModel.find({ guildId: interaction.guild.id, targetId: user.id })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "neutral",
          title: `History • ${user.username}`,
          fields: [
            {
              name: "Warnings",
              value: warns.length
                ? warns.map((w) => `• ${w.reason} (${w.weight}x)`).join("\n").slice(0, 1024)
                : "None",
            },
            {
              name: "Moderation cases",
              value: logs.length
                ? logs.map((l) => `• ${l.action} (${l.caseId})`).join("\n").slice(0, 1024)
                : "None",
            },
          ],
        }),
      ],
    });
  },
};

export const moderationCommands: SlashCommand[] = [
  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
  muteCommand,
  unmuteCommand,
  purgeCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,
  nicknameCommand,
  roleCommand,
  massroleCommand,
  modlogsCommand,
  historyCommand,
];
