import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../interfaces/ICommand.js";
import { DynamicEmbedBuilder } from "../../utils/embedBuilder.js";

const LANGUAGES = [
  { name: "English", value: "en" },
  { name: "Spanish", value: "es" },
  { name: "French", value: "fr" },
  { name: "German", value: "de" },
  { name: "Italian", value: "it" },
  { name: "Portuguese", value: "pt" },
  { name: "Russian", value: "ru" },
  { name: "Japanese", value: "ja" },
  { name: "Korean", value: "ko" },
  { name: "Chinese Simplified", value: "zh-CN" },
  { name: "Arabic", value: "ar" },
  { name: "Hindi", value: "hi" },
  { name: "Dutch", value: "nl" },
  { name: "Polish", value: "pl" },
  { name: "Turkish", value: "tr" },
  { name: "Vietnamese", value: "vi" },
  { name: "Filipino", value: "tl" },
] as const;

function languageName(code: string) {
  return LANGUAGES.find((language) => language.value === code)?.name ?? code;
}

function translatedTextFromGoogleResponse(value: unknown) {
  if (!Array.isArray(value)) return null;
  const segments = value[0];
  if (!Array.isArray(segments)) return null;
  const translated = segments
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
    .join("")
    .trim();
  return translated || null;
}

async function translateText(text: string, targetLanguage: string) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t" +
    `&tl=${encodeURIComponent(targetLanguage)}&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "ark-enterprise-discord-bot/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Translation request failed with ${response.status}`);
  }

  return translatedTextFromGoogleResponse(await response.json());
}

export const translateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate pasted text into a selected language.")
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Language to translate into")
        .setRequired(true)
        .addChoices(...LANGUAGES),
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Copy and paste the message text to translate")
        .setRequired(true)
        .setMaxLength(2000),
    ),
  meta: { cooldownMs: 5000, deferReply: true, deferEphemeral: true },
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const targetLanguage = interaction.options.getString("language", true);
    const sourceText = interaction.options.getString("text", true).trim();
    const translated = await translateText(sourceText, targetLanguage);

    if (!translated) {
      await interaction.editReply({
        embeds: [
          DynamicEmbedBuilder.build({
            theme: "alert",
            title: "Translate",
            description: "I could not translate that text. Try a shorter message or a different language.",
          }),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        DynamicEmbedBuilder.build({
          theme: "ark",
          title: `Translated to ${languageName(targetLanguage)}`,
          description: translated.slice(0, 4000),
          fields: [{ name: "Original", value: sourceText.slice(0, 1000) }],
        }),
      ],
    });
  },
};
