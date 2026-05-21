import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { SlashCommand } from "../../interfaces/ICommand.js";

import { publicMeta } from "../../core/commandMeta.js";
import { reply } from "../../core/commandUi.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";



const COMMAND_GROUPS = [

  {

    name: "Regular users",

    value:

      "`/about`, `/help`, `/server`, `/user`, `/avatar`, `/banner`, `/afk`, `/translate`, `/suggest`, `/coin-flip`, `/rock-paper-scissors`, `/role-info`, `/invite`, `/wallet`, `/animal`",

  },

  {

    name: "Tickets",

    value: "`/ticket create` (anyone) · staff: close, claim, transcript, … · `/panel` · `/tickets configs` (staff)",

  },

  {

    name: "Moderation actions",

    value:

      "`/warn`, `/timeout`, `/mute`, `/unmute`, `/kick`, `/ban`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nickname`, `/role`, `/modlogs`, `/history`, `/jail`, `/unjail`",

  },

  {

    name: "Category config commands",

    value:

      "Each category uses `/category configs <action>` — e.g. `/moderation configs status`, `/welcome configs setup`, `/automod configs enable`.\n" +

      "**Categories:** `moderation`, `welcome`, `automod`, `logging`, `security`, `tickets`, `economy`, `roles`, `levels`, `music`, `giveaway`, `suggestions`, `membercount`, `reactionrole`, `backup`, `utility`, `fun`, `starboard`, `ai`",

  },

  {

    name: "Commands-only channels",

    value:

      "In **commands-only** channels (e.g. `#commands`), normal chat is removed — use **slash commands** only. Run `/utility configs status` to see which channels are restricted. Staff can add channels with `/utility configs set-command-channel`.",

  },

  {

    name: "Staff / events / donations",

    value:

      "`/config` (legacy panel), `/event-*`, `/donation-*`, `/giveaway-*`, `/poll-*`, `/membercount-setup`, `/reaction-role-create`, `/color-role-create`",

  },

];



export const helpCommand: SlashCommand = {

  data: new SlashCommandBuilder().setName("help").setDescription("Show what the bot can do and who can use it."),

  meta: { ...publicMeta, cooldownMs: 5000 },

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    await reply(
      interaction,
      DynamicEmbedBuilder.build({
        theme: "ark",
        title: "Silk Manager Help",
        description:
          "Commands are organized by **category config** groups. Use `/help` anytime. Subcommands are shown as `configs <action>` under each category.",
        fields: [
          ...COMMAND_GROUPS,
          {
            name: "Permission notes",
            value: `Moderator commands use Discord permissions like \`${String(PermissionFlagsBits.ModerateMembers)}\`. Config commands usually require **Manage Server** or **Administrator**.`,
          },
        ],
      }),
    );
  },

};


