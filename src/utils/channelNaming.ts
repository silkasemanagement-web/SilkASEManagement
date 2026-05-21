export const CHANNEL_NAME_SEP = "┃";

export function slugifyChannelLabel(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[「」『』┏┓┣┗╋╭╮・•❯─━»\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function firstChannelEmoji(text: string) {
  const match = text.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u);
  return match?.[0] ?? null;
}

function isEmojiLead(value: string) {
  return /\p{Extended_Pictographic}/u.test(value);
}

export function stripChannelDecorations(text: string) {
  return text
    .replace(/[┏┓┣┗╋╭╮「」『』・•❯─━»\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNewChannelNameFormat(name: string) {
  const sep = name.indexOf(CHANNEL_NAME_SEP);
  if (sep <= 0) return false;
  const emoji = name.slice(0, sep);
  const slug = name.slice(sep + CHANNEL_NAME_SEP.length);
  return isEmojiLead(emoji) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function categoryFallbackEmoji(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("ticket") || lower.includes("support")) return "🎫";
  if (lower.includes("log")) return "📄";
  if (lower.includes("voice") || lower.includes("vc")) return "🔊";
  if (lower.includes("staff") || lower.includes("admin")) return "👮";
  if (lower.includes("event")) return "🎮";
  if (lower.includes("alpha") || lower.includes("cluster")) return "🌎";
  if (lower.includes("donation")) return "💎";
  if (lower.includes("archive")) return "📦";
  if (lower.includes("stat")) return "📊";
  if (lower.includes("welcome")) return "👋";
  if (lower.includes("community")) return "💬";
  if (lower.includes("jail")) return "🔴";
  return "📁";
}

export function convertChannelName(current: string): string | null {
  if (!current.trim()) return null;

  const sep = current.indexOf(CHANNEL_NAME_SEP);
  if (sep > 0) {
    const emoji = current.slice(0, sep).trim();
    const rest = current.slice(sep + CHANNEL_NAME_SEP.length).trim();
    const slug = slugifyChannelLabel(rest);
    if (emoji && slug && isEmojiLead(emoji)) {
      const normalized = `${emoji}${CHANNEL_NAME_SEP}${slug}`;
      return normalized === current ? null : normalized;
    }
  }

  const bracketEmoji = current.match(/[「『]([\p{Extended_Pictographic}\uFE0F\u200D]+)[」』]/u);
  const looseEmoji = current.match(/[「」]+([\p{Extended_Pictographic}\uFE0F\u200D]+)/u);
  const leadingEmoji = firstChannelEmoji(current);
  let emoji = bracketEmoji?.[1] ?? looseEmoji?.[1] ?? leadingEmoji;
  if (emoji && !isEmojiLead(emoji)) emoji = null;
  if (!emoji) return null;

  let label = current;
  if (bracketEmoji) {
    label = label.replace(/[┏┓┣┗╋╭╮]*[「『][\p{Extended_Pictographic}\uFE0F\u200D]+[」』][\s・]*/u, "");
  } else if (looseEmoji) {
    label = label.replace(/[「」]+[\p{Extended_Pictographic}\uFE0F\u200D]+[\s・]*/u, "");
  } else {
    label = label.replace(new RegExp(`^${escapeRegex(emoji)}[\\s・]*`), "");
  }

  label = stripChannelDecorations(label);
  const slug = slugifyChannelLabel(label);
  if (!slug) return null;

  const next = `${emoji}${CHANNEL_NAME_SEP}${slug}`;
  return next === current ? null : next;
}

export function convertCategoryName(current: string): string | null {
  if (current.includes(CHANNEL_NAME_SEP)) return convertChannelName(current);

  const bracketLabel = current.match(/[「『]([^」』]+)[」』]/);
  let emoji = firstChannelEmoji(current);
  if (emoji && !isEmojiLead(emoji)) emoji = null;
  emoji ??= categoryFallbackEmoji(bracketLabel?.[1] ?? current);

  const rawLabel = bracketLabel?.[1] ?? stripChannelDecorations(current.replace(/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu, ""));
  const slug = slugifyChannelLabel(rawLabel);
  if (!slug) return null;

  const next = `${emoji}${CHANNEL_NAME_SEP}${slug}`;
  return next === current ? null : next;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
