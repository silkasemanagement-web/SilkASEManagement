import type { SlashCommand } from "../interfaces/ICommand.js";
import { categoryConfigCommands } from "./categories/index.js";
import { embedCreateCommand } from "./embed/embed-create.js";
import { configCommand } from "./config/config.js";
import { moderationCommands } from "./moderation/moderation.js";
import { jailCommand, unjailCommand } from "./moderation/jail.js";
import { suggestCommand } from "./suggestions/suggest.js";
import { giveawayCancelCommand, giveawayCreateCommand, giveawayEndCommand } from "./giveaways/giveaway-create.js";
import { pollCreateCommand, pollEndCommand } from "./polls/poll-create.js";
import { reactionRoleCreateCommand } from "./reactionroles/reaction-role-create.js";
import { colorRoleCreateCommand } from "./colorroles/color-role-create.js";
import { emojiAddCommand } from "./emojis/emoji-add.js";
import { emojiRemoveCommand } from "./emojis/emoji-remove.js";
import { donationDiscountsCommand } from "./donations/donation-discounts.js";
import { donationAddCommand, donationRemoveCommand, donationsListCommand } from "./donations/donation-ledger.js";
import { antiNukeCommand } from "./security/anti-nuke.js";
import { eventManagementCommands } from "./events/event-management.js";
import { eventNumberCommand } from "./events/event-number.js";
import { eventDinoCommand } from "./events/event-dino.js";
import { rollbackPingsCommand } from "./events/rollback-pings.js";
import { eventVoiceLastLeaveCommand } from "./events/event-voice-lastleave.js";
import { membercountSetupCommand } from "./stats/membercount-setup.js";
import { afkCommand } from "./utility/afk.js";
import { aboutCommand } from "./utility/about.js";
import { avatarCommand } from "./utility/avatar.js";
import { bannerCommand } from "./utility/banner.js";
import { coinFlipCommand } from "./utility/coin-flip.js";
import { helpCommand } from "./utility/help.js";
import { inviteCommand } from "./utility/invite.js";
import { rockPaperScissorsCommand } from "./utility/rock-paper-scissors.js";
import { roleInfoCommand } from "./utility/role-info.js";
import { serverCommand } from "./utility/server.js";
import { translateCommand } from "./utility/translate.js";
import { userCommand } from "./utility/user.js";
import { groupedExpansionCommands } from "./expansion/groupedCommands.js";
import { walletCommand } from "./wallet.js";
import { ticketSlashCommand, ticketsSlashCommand, adminTicketsSlashCommand } from "../tickets/index.js";

export const allCommands: SlashCommand[] = [
  embedCreateCommand,
  configCommand,
  suggestCommand,
  donationDiscountsCommand,
  donationAddCommand,
  donationRemoveCommand,
  donationsListCommand,
  antiNukeCommand,
  giveawayCreateCommand,
  giveawayEndCommand,
  giveawayCancelCommand,
  pollCreateCommand,
  pollEndCommand,
  reactionRoleCreateCommand,
  colorRoleCreateCommand,
  emojiAddCommand,
  emojiRemoveCommand,
  ...eventManagementCommands,
  eventNumberCommand,
  eventDinoCommand,
  rollbackPingsCommand,
  eventVoiceLastLeaveCommand,
  membercountSetupCommand,
  aboutCommand,
  helpCommand,
  serverCommand,
  userCommand,
  afkCommand,
  avatarCommand,
  bannerCommand,
  coinFlipCommand,
  inviteCommand,
  rockPaperScissorsCommand,
  roleInfoCommand,
  translateCommand,
  jailCommand,
  unjailCommand,
  walletCommand,
  ...categoryConfigCommands.filter((cmd) => {
    const data = typeof cmd.data === "function" ? cmd.data() : cmd.data;
    return data.name !== "tickets";
  }),
  ticketSlashCommand,
  ticketsSlashCommand,
  adminTicketsSlashCommand,
  ...groupedExpansionCommands,
  ...moderationCommands,
];
