import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  OverwriteType,
  type Guild,
  type GuildBasedChannel,
  type GuildChannelCreateOptions,
  type PermissionOverwrites,
  type Role,
} from "discord.js";
import { loadEnv } from "../src/config/env.js";

const SOURCE_GUILD_ID = "973056995466805288";
const BACKUP_ROOT = path.join(process.cwd(), "backups", "discord-layouts");
const SUPPORTED_CHANNEL_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

type RoleBackup = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  position: number;
  permissions: string;
  isEveryone: boolean;
};

type PermissionOverwriteBackup = {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
  roleName?: string;
};

type ChannelBackup = {
  id: string;
  name: string;
  type: ChannelType;
  typeName: string;
  parentId: string | null;
  parentName: string | null;
  rawPosition: number;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number | null;
  bitrate?: number;
  userLimit?: number;
  permissionOverwrites: PermissionOverwriteBackup[];
};

type GuildLayoutBackup = {
  guildId: string;
  guildName: string;
  exportedAt: string;
  roles: RoleBackup[];
  channels: ChannelBackup[];
};

type ApplyResult = {
  deletedChannels: number;
  deletedRoles: number;
  createdRoles: number;
  createdCategories: number;
  createdChannels: number;
  skippedRoles: string[];
  skippedChannels: string[];
  skippedOverwrites: number;
};

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function channelTypeName(type: ChannelType) {
  return ChannelType[type] ?? `Unknown_${type}`;
}

function roleBackup(role: Role): RoleBackup {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    managed: role.managed,
    mentionable: role.mentionable,
    position: role.position,
    permissions: role.permissions.bitfield.toString(),
    isEveryone: role.id === role.guild.id,
  };
}

function permissionOverwriteBackup(overwrite: PermissionOverwrites, guild: Guild): PermissionOverwriteBackup {
  const role = overwrite.type === OverwriteType.Role ? guild.roles.cache.get(overwrite.id) : undefined;
  return {
    id: overwrite.id,
    type: overwrite.type === OverwriteType.Role ? "role" : "member",
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
    roleName: role?.name,
  };
}

function channelBackup(channel: GuildBasedChannel, guild: Guild): ChannelBackup {
  const base: ChannelBackup = {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    typeName: channelTypeName(channel.type),
    parentId: "parentId" in channel ? channel.parentId : null,
    parentName: "parent" in channel ? channel.parent?.name ?? null : null,
    rawPosition: "rawPosition" in channel ? channel.rawPosition : 0,
    permissionOverwrites:
      "permissionOverwrites" in channel
        ? [...channel.permissionOverwrites.cache.values()].map((overwrite) => permissionOverwriteBackup(overwrite, guild))
        : [],
  };

  if ("topic" in channel) base.topic = channel.topic;
  if ("nsfw" in channel) base.nsfw = channel.nsfw;
  if ("rateLimitPerUser" in channel) base.rateLimitPerUser = channel.rateLimitPerUser;
  if ("bitrate" in channel) base.bitrate = channel.bitrate;
  if ("userLimit" in channel) base.userLimit = channel.userLimit;

  return base;
}

async function fetchLayout(guild: Guild): Promise<GuildLayoutBackup> {
  await guild.roles.fetch();
  await guild.channels.fetch();

  const exportedAt = new Date().toISOString();
  const roles = [...guild.roles.cache.values()]
    .map(roleBackup)
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
  const channels = [...guild.channels.cache.values()]
    .map((channel) => channelBackup(channel, guild))
    .sort((a, b) => {
      const parentCompare = (a.parentName ?? a.name).localeCompare(b.parentName ?? b.name);
      return parentCompare || a.rawPosition - b.rawPosition || a.name.localeCompare(b.name);
    });

  return {
    guildId: guild.id,
    guildName: guild.name,
    exportedAt,
    roles,
    channels,
  };
}

function countChannels(layout: GuildLayoutBackup, type: ChannelType) {
  return layout.channels.filter((channel) => channel.type === type).length;
}

function buildPreview(source: GuildLayoutBackup, target: GuildLayoutBackup) {
  const targetRoleNames = new Set(target.roles.map((role) => role.name.toLowerCase()));
  const targetChannelNames = new Set(target.channels.map((channel) => channel.name.toLowerCase()));
  const copyableSourceRoles = source.roles.filter((role) => !role.isEveryone && !role.managed);
  const sourceCategories = source.channels.filter((channel) => channel.type === ChannelType.GuildCategory);
  const sourceNonCategories = source.channels.filter((channel) => channel.type !== ChannelType.GuildCategory);
  const rolesToCreate = copyableSourceRoles.filter((role) => !targetRoleNames.has(role.name.toLowerCase()));
  const matchingRoles = copyableSourceRoles.length - rolesToCreate.length;
  const channelsWithSameName = source.channels.filter((channel) => targetChannelNames.has(channel.name.toLowerCase()));

  return {
    copyableSourceRoles: copyableSourceRoles.length,
    rolesToCreate: rolesToCreate.length,
    matchingRoles,
    sourceCategories: sourceCategories.length,
    sourceNonCategoryChannels: sourceNonCategories.length,
    currentTargetChannels: target.channels.length,
    channelsWithSameName: channelsWithSameName.length,
    permissionOverwrites: source.channels.reduce((total, channel) => total + channel.permissionOverwrites.length, 0),
  };
}

async function writeBackup(name: string, layout: GuildLayoutBackup, backupDir: string) {
  const filePath = path.join(backupDir, `${name}-${layout.guildId}.json`);
  await writeFile(filePath, `${JSON.stringify(layout, null, 2)}\n`, "utf8");
  return filePath;
}

function mapPermissionOverwrites(
  channel: ChannelBackup,
  sourceLayout: GuildLayoutBackup,
  targetGuild: Guild,
  roleNameToId: Map<string, string>,
) {
  const overwrites: Array<{ id: string; type: OverwriteType; allow: bigint; deny: bigint }> = [];
  let skipped = 0;

  for (const overwrite of channel.permissionOverwrites) {
    if (overwrite.type === "member") {
      skipped += 1;
      continue;
    }

    let targetId: string | undefined;
    if (overwrite.id === sourceLayout.guildId || overwrite.roleName === "@everyone") {
      targetId = targetGuild.id;
    } else if (overwrite.roleName) {
      targetId = roleNameToId.get(overwrite.roleName.toLowerCase());
    }

    if (!targetId) {
      skipped += 1;
      continue;
    }

    overwrites.push({
      id: targetId,
      type: OverwriteType.Role,
      allow: BigInt(overwrite.allow),
      deny: BigInt(overwrite.deny),
    });
  }

  return { overwrites, skipped };
}

async function deleteTargetChannels(targetGuild: Guild) {
  await targetGuild.channels.fetch();
  const channels = [...targetGuild.channels.cache.values()].sort((a, b) => {
    if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return 1;
    if (a.type !== ChannelType.GuildCategory && b.type === ChannelType.GuildCategory) return -1;
    const aPosition = "rawPosition" in a ? a.rawPosition : 0;
    const bPosition = "rawPosition" in b ? b.rawPosition : 0;
    return bPosition - aPosition;
  });

  let deleted = 0;
  for (const channel of channels) {
    await channel.delete("Replacing SILK layout from source server").then(
      () => {
        deleted += 1;
      },
      (err) => {
        console.warn(`Skipped deleting channel ${channel.name} (${channel.id}): ${err instanceof Error ? err.message : String(err)}`);
      },
    );
  }
  return deleted;
}

async function replaceTargetRoles(sourceLayout: GuildLayoutBackup, targetGuild: Guild, result: ApplyResult) {
  await targetGuild.roles.fetch();
  const botMember = await targetGuild.members.fetchMe();
  const botTopPosition = botMember.roles.highest.position;

  const deletableTargetRoles = [...targetGuild.roles.cache.values()]
    .filter((role) => role.id !== targetGuild.id && !role.managed && role.position < botTopPosition)
    .sort((a, b) => b.position - a.position);

  for (const role of deletableTargetRoles) {
    await role.delete("Replacing SILK roles from source server").then(
      () => {
        result.deletedRoles += 1;
      },
      (err) => {
        result.skippedRoles.push(`delete ${role.name}: ${err instanceof Error ? err.message : String(err)}`);
      },
    );
  }

  const sourceEveryone = sourceLayout.roles.find((role) => role.isEveryone);
  if (sourceEveryone) {
    await targetGuild.roles.everyone
      .setPermissions(BigInt(sourceEveryone.permissions), "Copying @everyone permissions from source server")
      .catch((err) => {
        result.skippedRoles.push(`@everyone permissions: ${err instanceof Error ? err.message : String(err)}`);
      });
  }

  const roleNameToId = new Map<string, string>([["@everyone", targetGuild.id]]);
  const copyableSourceRoles = sourceLayout.roles
    .filter((role) => !role.isEveryone && !role.managed)
    .sort((a, b) => a.position - b.position);

  for (const sourceRole of copyableSourceRoles) {
    const created = await targetGuild.roles
      .create({
        name: sourceRole.name,
        color: sourceRole.color,
        hoist: sourceRole.hoist,
        mentionable: sourceRole.mentionable,
        permissions: BigInt(sourceRole.permissions),
        reason: "Copying roles from source server",
      })
      .catch((err) => {
        result.skippedRoles.push(`create ${sourceRole.name}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });

    if (!created) continue;
    result.createdRoles += 1;
    roleNameToId.set(sourceRole.name.toLowerCase(), created.id);

    const safePosition = Math.min(sourceRole.position, Math.max(botTopPosition - 1, 1));
    await created.setPosition(safePosition, { reason: "Matching copied source role order" }).catch((err) => {
      result.skippedRoles.push(`position ${sourceRole.name}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  return roleNameToId;
}

async function createTargetChannels(
  sourceLayout: GuildLayoutBackup,
  targetGuild: Guild,
  roleNameToId: Map<string, string>,
  result: ApplyResult,
) {
  const categoryIdBySourceId = new Map<string, string>();
  const categories = sourceLayout.channels
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition);
  const channels = sourceLayout.channels
    .filter((channel) => channel.type !== ChannelType.GuildCategory)
    .sort((a, b) => (a.parentName ?? "").localeCompare(b.parentName ?? "") || a.rawPosition - b.rawPosition);

  for (const category of categories) {
    const mapped = mapPermissionOverwrites(category, sourceLayout, targetGuild, roleNameToId);
    result.skippedOverwrites += mapped.skipped;
    const created = await targetGuild.channels
      .create({
        name: category.name,
        type: ChannelType.GuildCategory,
        position: category.rawPosition,
        permissionOverwrites: mapped.overwrites,
        reason: "Copying categories from source server",
      })
      .catch((err) => {
        result.skippedChannels.push(`category ${category.name}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });

    if (!created) continue;
    result.createdCategories += 1;
    categoryIdBySourceId.set(category.id, created.id);
  }

  for (const sourceChannel of channels) {
    if (!SUPPORTED_CHANNEL_TYPES.has(sourceChannel.type)) {
      result.skippedChannels.push(`${sourceChannel.name}: unsupported channel type ${sourceChannel.typeName}`);
      continue;
    }

    const mapped = mapPermissionOverwrites(sourceChannel, sourceLayout, targetGuild, roleNameToId);
    result.skippedOverwrites += mapped.skipped;
    const parent = sourceChannel.parentId ? categoryIdBySourceId.get(sourceChannel.parentId) : undefined;
    const options: GuildChannelCreateOptions = {
      name: sourceChannel.name,
      type: sourceChannel.type as GuildChannelCreateOptions["type"],
      parent,
      position: sourceChannel.rawPosition,
      permissionOverwrites: mapped.overwrites,
      reason: "Copying channels from source server",
      topic: sourceChannel.topic ?? undefined,
      nsfw: sourceChannel.nsfw,
      rateLimitPerUser: sourceChannel.rateLimitPerUser ?? undefined,
      bitrate: sourceChannel.bitrate,
      userLimit: sourceChannel.userLimit,
    };

    const created = await targetGuild.channels
      .create(options)
      .catch((err) => {
        result.skippedChannels.push(`${sourceChannel.name}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });

    if (created) result.createdChannels += 1;
  }
}

async function applyReplace(sourceLayout: GuildLayoutBackup, targetGuild: Guild): Promise<ApplyResult> {
  const result: ApplyResult = {
    deletedChannels: 0,
    deletedRoles: 0,
    createdRoles: 0,
    createdCategories: 0,
    createdChannels: 0,
    skippedRoles: [],
    skippedChannels: [],
    skippedOverwrites: 0,
  };

  result.deletedChannels = await deleteTargetChannels(targetGuild);
  const roleNameToId = await replaceTargetRoles(sourceLayout, targetGuild, result);
  await createTargetChannels(sourceLayout, targetGuild, roleNameToId, result);
  return result;
}

async function main() {
  const env = loadEnv();
  const shouldApply = process.argv.includes("--apply");
  const shouldReplace = process.argv.includes("--replace");
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  const stamp = timestampForPath();
  const backupDir = path.join(BACKUP_ROOT, stamp);

  await mkdir(backupDir, { recursive: true });
  await client.login(env.DISCORD_TOKEN);

  try {
    const sourceGuild = await client.guilds.fetch(SOURCE_GUILD_ID);
    const targetGuild = await client.guilds.fetch(env.MAIN_GUILD_ID);

    const [sourceLayout, targetLayout] = await Promise.all([fetchLayout(sourceGuild), fetchLayout(targetGuild)]);
    const [sourcePath, targetPath] = await Promise.all([
      writeBackup("source", sourceLayout, backupDir),
      writeBackup("main-silk-current", targetLayout, backupDir),
    ]);
    const preview = buildPreview(sourceLayout, targetLayout);

    console.log("Discord layout backup and preview complete. No Discord changes were made.");
    console.log(`Source: ${sourceLayout.guildName} (${sourceLayout.guildId})`);
    console.log(`Target: ${targetLayout.guildName} (${targetLayout.guildId})`);
    console.log(`Backups:`);
    console.log(`- ${sourcePath}`);
    console.log(`- ${targetPath}`);
    console.log("Preview:");
    console.log(`- Copyable source roles: ${preview.copyableSourceRoles}`);
    console.log(`- Roles that would be created by name: ${preview.rolesToCreate}`);
    console.log(`- Roles that already match by name: ${preview.matchingRoles}`);
    console.log(`- Source categories: ${preview.sourceCategories}`);
    console.log(`- Source non-category channels: ${preview.sourceNonCategoryChannels}`);
    console.log(`- Current target channels/categories: ${preview.currentTargetChannels}`);
    console.log(`- Source channels with same name already in target: ${preview.channelsWithSameName}`);
    console.log(`- Source permission overwrites captured: ${preview.permissionOverwrites}`);
    console.log("Source channel type counts:");
    console.log(`- Text: ${countChannels(sourceLayout, ChannelType.GuildText)}`);
    console.log(`- Voice: ${countChannels(sourceLayout, ChannelType.GuildVoice)}`);
    console.log(`- Announcement: ${countChannels(sourceLayout, ChannelType.GuildAnnouncement)}`);
    console.log(`- Stage: ${countChannels(sourceLayout, ChannelType.GuildStageVoice)}`);
    console.log(`- Forum: ${countChannels(sourceLayout, ChannelType.GuildForum)}`);

    if (shouldApply) {
      if (!shouldReplace) throw new Error("Refusing to apply without --replace. Use npm run layout:apply:replace after confirmation.");

      console.log("Applying destructive replacement: roles, categories, and channels only.");
      const result = await applyReplace(sourceLayout, targetGuild);
      console.log("Layout replacement complete.");
      console.log(`- Deleted target channels/categories: ${result.deletedChannels}`);
      console.log(`- Deleted target roles: ${result.deletedRoles}`);
      console.log(`- Created copied roles: ${result.createdRoles}`);
      console.log(`- Created copied categories: ${result.createdCategories}`);
      console.log(`- Created copied non-category channels: ${result.createdChannels}`);
      console.log(`- Skipped permission overwrites: ${result.skippedOverwrites}`);
      console.log(`- Skipped role actions: ${result.skippedRoles.length}`);
      console.log(`- Skipped channel actions: ${result.skippedChannels.length}`);
      if (result.skippedRoles.length) console.log(result.skippedRoles.map((item) => `  role: ${item}`).join("\n"));
      if (result.skippedChannels.length) console.log(result.skippedChannels.map((item) => `  channel: ${item}`).join("\n"));
    }
  } finally {
    client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
