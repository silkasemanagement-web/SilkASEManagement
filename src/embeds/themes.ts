import type { ColorResolvable } from "discord.js";

export type EmbedThemeName = "ark" | "donation" | "alert" | "neutral";

export const EMBED_THEMES: Record<
  EmbedThemeName,
  { color: ColorResolvable; authorIcon?: string }
> = {
  // SILK ASE branding: vivid premium red across all bot embeds.
  ark: { color: 0xff0033 },
  donation: { color: 0xff0033 },
  alert: { color: 0xff1744 },
  neutral: { color: 0xff0033 },
};
