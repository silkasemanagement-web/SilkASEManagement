const DISCORD_CDN = /https:\/\/cdn\.discordapp\.com\//i;
const GENERIC_IMAGE = /\.(png|jpe?g|gif|webp)$/i;

export function sanitizeText(input: string, max = 4000): string {
  return input.replace(/@everyone|@here/g, "@\u200beveryone").slice(0, max);
}

export function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return undefined;
    if (DISCORD_CDN.test(url) || GENERIC_IMAGE.test(u.pathname)) return u.toString();
    return u.toString();
  } catch {
    return undefined;
  }
}

export function parseColorHex(input: string): number | undefined {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return Number.parseInt(hex, 16);
}
