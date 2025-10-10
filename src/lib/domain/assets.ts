import { AssetDefinition } from "./types";

/**
 * CENTRALIZED ASSET DEFINITIONS
 * 
 * This is the single source of truth for all assets in the application.
 * To add a new asset, simply:
 * 1. Create a new AssetDefinition object below
 * 2. Add it to DEFAULT_ASSETS
 * 
 * All API routes (/api/quotes/all, /api/historical-prices, /api/price-at)
 * will automatically use this configuration - no hardcoded logic needed!
 * 
 * Example: To add Ethereum:
 * 
 * export const ETH_ASSET: AssetDefinition = {
 *   id: "eth",
 *   displayName: "Ethereum",
 *   kind: "crypto",
 *   quoteSource: "coingecko",
 *   coingeckoId: "ethereum",
 *   priceCurrency: "EUR",
 *   decimals: 8,
 * };
 * 
 * Then add to DEFAULT_ASSETS: [ETH_ASSET.id]: ETH_ASSET
 */

export const BTC_ASSET: AssetDefinition = {
  id: "btc",
  displayName: "Bitcoin",
  kind: "crypto",
  quoteSource: "coingecko",
  coingeckoId: "bitcoin",
  priceCurrency: "EUR",
  decimals: 8,
};

export const INVESCO_FTSE_ALL_WORLD_ASSET: AssetDefinition = {
  id: "etf:invesco-ftse-all-world",
  displayName: "Invesco FTSE All-World",
  kind: "etf",
  quoteSource: "yahoo",
  yahooSymbol: "FWRG.L",
  priceCurrency: "GBp", // Yahoo returns in pence
  decimals: 2,
};

export const DEFAULT_ASSETS: Record<string, AssetDefinition> = {
  [BTC_ASSET.id]: BTC_ASSET,
  [INVESCO_FTSE_ALL_WORLD_ASSET.id]: INVESCO_FTSE_ALL_WORLD_ASSET,
};

/**
 * Get asset definition by ID
 */
export function getAssetById(assetId: string): AssetDefinition | undefined {
  return DEFAULT_ASSETS[assetId];
}

/**
 * Get all registered assets
 */
export function getAllAssets(): AssetDefinition[] {
  return Object.values(DEFAULT_ASSETS);
}

/**
 * Validate that all required fields are present for an asset
 */
export function validateAssetConfig(asset: AssetDefinition): boolean {
  if (asset.quoteSource === "coingecko" && !asset.coingeckoId) {
    return false;
  }
  if (asset.quoteSource === "yahoo" && !asset.yahooSymbol) {
    return false;
  }
  return true;
}
