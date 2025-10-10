import { z } from "zod";

export type AssetKind = "crypto" | "etf" | "stock";
export type AssetId = string; // e.g., "btc", "etf:invesco-ftse-all-world"

export type QuoteSource = "coingecko" | "yahoo";

/**
 * Asset definition - the single source of truth for asset configuration.
 * 
 * To add a new asset, simply create a new AssetDefinition object and add it to DEFAULT_ASSETS.
 * All API routes will automatically use this configuration.
 */
export interface AssetDefinition {
  id: AssetId;
  displayName: string;
  kind: AssetKind;
  quoteSource: QuoteSource;
  /** For CoinGecko lookups when quoteSource === "coingecko" */
  coingeckoId?: string;
  /** For Yahoo Finance lookups when quoteSource === "yahoo" */
  yahooSymbol?: string;
  /** Currency the source quote is denominated in */
  priceCurrency: "EUR" | "USD" | "GBp" | "GBX" | "GBP";
  /** Number of fractional digits typically used for this asset */
  decimals: number;
}

export const TransactionSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  /** Unix epoch milliseconds */
  timestamp: z.number(),
  /** Positive quantity of the asset purchased */
  quantity: z.number().nonnegative(),
  /** Purchase price per unit in EUR at the time of the transaction */
  pricePerUnitEUR: z.number().nonnegative(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export interface AssetPosition {
  assetId: AssetId;
  quantityHeld: number;
  /** Sum of (quantity * pricePerUnitEUR) for all buys */
  deployedCapitalEUR: number;
}

export interface PortfolioTotals {
  deployedCapitalEUR: number;
  currentValueEUR: number;
  profitEUR: number;
  /** profit / deployedCapitalEUR (0 if deployedCapitalEUR is 0) */
  returnPct: number;
}

export interface AssetValuation {
  assetId: AssetId;
  currentPriceEUR: number;
  currentValueEUR: number;
  position: AssetPosition;
}

export interface PortfolioSnapshot {
  assets: AssetValuation[];
  totals: PortfolioTotals;
}
