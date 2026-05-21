import { aiCategoryCommand } from "./ai.js";
import { automodCategoryCommand } from "./automod.js";
import { backupCategoryCommand } from "./backup.js";
import { economyCategoryCommand } from "./economy.js";
import { funCategoryCommand } from "./fun.js";
import { giveawayCategoryCommand } from "./giveaway.js";
import { levelsCategoryCommand } from "./levels.js";
import { loggingCategoryCommand } from "./logging.js";
import { membercountCategoryCommand } from "./membercount.js";
import { moderationCategoryCommand } from "./moderation.js";
import { musicCategoryCommand } from "./music.js";
import { reactionroleCategoryCommand } from "./reactionrole.js";
import { rolesCategoryCommand } from "./roles.js";
import { securityCategoryCommand } from "./security.js";
import { starboardCategoryCommand } from "./starboard.js";
import { suggestionsCategoryCommand } from "./suggestions.js";
import { ticketCategoryCommand } from "./tickets.js";
import { utilityCategoryCommand } from "./utility.js";
import { welcomeCategoryCommand } from "./welcome.js";

export const categoryConfigCommands = [
  moderationCategoryCommand,
  welcomeCategoryCommand,
  automodCategoryCommand,
  loggingCategoryCommand,
  securityCategoryCommand,
  ticketCategoryCommand,
  economyCategoryCommand,
  rolesCategoryCommand,
  levelsCategoryCommand,
  musicCategoryCommand,
  giveawayCategoryCommand,
  suggestionsCategoryCommand,
  membercountCategoryCommand,
  reactionroleCategoryCommand,
  backupCategoryCommand,
  utilityCategoryCommand,
  funCategoryCommand,
  starboardCategoryCommand,
  aiCategoryCommand,
];
