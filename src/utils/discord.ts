import { PermissionFlagsBits, type GuildMember, type GuildResolvable } from "discord.js";
import type { GuildConfigurationDocument } from "../models/GuildConfiguration.js";

export function memberHasAnyRole(member: GuildMember, roleIds: string[]): boolean {
  if (!roleIds.length) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

export function isStaff(member: GuildMember, cfg: GuildConfigurationDocument): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return memberHasAnyRole(member, [...cfg.staffRoleIds, ...cfg.adminRoleIds, ...cfg.helperRoleIds]);
}

export function isAdmin(member: GuildMember, cfg: GuildConfigurationDocument): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return memberHasAnyRole(member, cfg.adminRoleIds);
}

export function isEventManager(member: GuildMember, cfg: GuildConfigurationDocument): boolean {
  if (isAdmin(member, cfg)) return true;
  return memberHasAnyRole(member, cfg.eventManagerRoleIds);
}

export function hierarchyAllows(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === actor.guild.ownerId) return true;
  if (target.id === actor.guild.ownerId) return false;
  return actor.roles.highest.position > target.roles.highest.position;
}

export async function resolveMember(
  _guild: GuildResolvable,
  _userId: string,
): Promise<GuildMember | null> {
  void _guild;
  void _userId;
  // Caller should use guild.members.fetch - this is a placeholder for shared typing
  return null;
}
