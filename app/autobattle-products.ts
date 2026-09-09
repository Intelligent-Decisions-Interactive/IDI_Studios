export type AutoBattleProduct = {
  sku: string;
  paidTokens: number;
  bonusTokens: number;
  priceCents: number;
  featured?: boolean;
};

export const AUTOBATTLE_PRODUCTS: readonly AutoBattleProduct[] = [
  { sku: "tokens_5", paidTokens: 5, bonusTokens: 0, priceCents: 99 },
  { sku: "tokens_25", paidTokens: 25, bonusTokens: 5, priceCents: 499 },
  { sku: "tokens_50", paidTokens: 50, bonusTokens: 10, priceCents: 999 },
  { sku: "tokens_100", paidTokens: 100, bonusTokens: 25, priceCents: 1999, featured: true },
  { sku: "tokens_250", paidTokens: 250, bonusTokens: 50, priceCents: 4999 },
  { sku: "tokens_500", paidTokens: 500, bonusTokens: 100, priceCents: 9999 },
] as const;

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
