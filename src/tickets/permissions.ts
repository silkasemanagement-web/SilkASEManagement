import { OverwriteType, PermissionFlagsBits, type Guild, type Snowflake } from "discord.js";

export const TICKET_VIEW_PERMS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory;

export const BOT_TICKET_PERMS = TICKET_VIEW_PERMS | PermissionFlagsBits.ManageChannels;

function snowflakeId(value: unknown): value is Snowflake {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

export async function resolveTicketStaffRoleIds(guild: Guild, staffRoleIds: string[]) {
  const unique = [...new Set(staffRoleIds.filter(snowflakeId))].filter((id) => id !== guild.id);
  const resolved: Snowflake[] = [];
  for (const roleId of unique) {
    const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
    if (role) resolved.push(role.id);
  }
  return resolved;
}

export function buildTicketPermissionOverwrites(params: {
  guildId: string;
  openerId: string;
  botMemberId: string;
  staffRoleIds: Snowflake[];
}) {
  return [
    { id: params.guildId, type: OverwriteType.Role, deny: PermissionFlagsBits.ViewChannel },
    { id: params.openerId, type: OverwriteType.Member, allow: TICKET_VIEW_PERMS },
    { id: params.botMemberId, type: OverwriteType.Member, allow: BOT_TICKET_PERMS },
    ...params.staffRoleIds.map((roleId) => ({
      id: roleId,
      type: OverwriteType.Role,
      allow: TICKET_VIEW_PERMS,
    })),
  ];
}

export function describeChannelCreateError(err: unknown) {
  if (typeof err !== "object" || err === null) return "Unknown error while creating the channel.";
  const code = "code" in err ? String((err as { code?: unknown }).code) : "";
  const message = "message" in err ? String((err as { message?: unknown }).message) : "";
  if (code === "InvalidType" || message.includes("cached User or Role")) {
    return "Ticket permission setup failed (invalid staff role). Fix roles in `/tickets configs roles`.";
  }
  if (message.toLowerCase().includes("maximum number of channels") || code === "30013") {
    return "That ticket category is full (50 channel limit). Archive or delete old tickets.";
  }
  if (message.includes("Missing Permissions") || code === "50013") {
    return "The bot is missing **Manage Channels**. Move the bot role above ticket categories.";
  }
  return message ? `Could not create ticket channel: ${message}` : "Could not create the ticket channel.";
}
