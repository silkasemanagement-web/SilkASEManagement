import { FeatureStoreService } from "../services/FeatureStoreService.js";
import { alert as alertEmbed } from "./commandUi.js";

const store = new FeatureStoreService();

export function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function getBalance(guildId: string, userId: string) {
  const data = await store.get<{ balance?: number }>(guildId, "economy-balances", userId);
  return Number(data?.balance ?? 0);
}

export async function setBalance(guildId: string, userId: string, balance: number, actorId?: string) {
  await store.set(guildId, "economy-balances", userId, { balance: Math.max(0, Math.floor(balance)) }, actorId);
}

export async function addBalance(guildId: string, userId: string, amount: number, actorId?: string) {
  const next = (await getBalance(guildId, userId)) + amount;
  await setBalance(guildId, userId, next, actorId);
  return next;
}

export function alert(title: string, description: string) {
  return alertEmbed(title, description);
}
