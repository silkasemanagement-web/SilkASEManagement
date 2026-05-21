import type { ButtonInteraction } from "discord.js";
import { DynamicEmbedBuilder, type RichEmbedInput } from "./embedBuilder.js";

export async function handleEmbedPagination(params: {
  interaction: ButtonInteraction;
  customIdBase: string;
  pages: RichEmbedInput[];
  currentPage: number;
  direction: "first" | "prev" | "next" | "last" | "noop";
}): Promise<number> {
  const { pages, direction, currentPage } = params;
  if (direction === "noop") return currentPage;
  let next = currentPage;
  if (direction === "first") next = 0;
  if (direction === "prev") next = Math.max(0, currentPage - 1);
  if (direction === "next") next = Math.min(pages.length - 1, currentPage + 1);
  if (direction === "last") next = pages.length - 1;

  const embed = DynamicEmbedBuilder.paginatedEmbeds(pages)[next];
  const row = DynamicEmbedBuilder.paginationRow(params.customIdBase, next, pages.length);
  await params.interaction.update({ embeds: [embed], components: [row] });
  return next;
}
