import { NextRequest } from "next/server";
import { getAllAssets, validateAssetConfig } from "@/lib/domain/assets";
import { fetchCurrentPrice, convertToEUR } from "@/lib/services/priceService";

export const revalidate = 60; // seconds

interface QuoteResult {
  assetId: string;
  priceEUR: number | null;
  notice?: string;
}

export async function GET(_req: NextRequest) {
  try {
    const assets = getAllAssets();
    
    // Fetch prices for all assets in parallel
    const quotePromises = assets.map(async (asset): Promise<QuoteResult> => {
      // Validate asset configuration
      if (!validateAssetConfig(asset)) {
        return {
          assetId: asset.id,
          priceEUR: null,
          notice: `Invalid asset configuration for ${asset.displayName}`,
        };
      }

      try {
        const result = await fetchCurrentPrice(asset);
        
        if (!result) {
          return {
            assetId: asset.id,
            priceEUR: null,
            notice: `Quote unavailable for ${asset.displayName}`,
          };
        }

        // Convert to EUR
        const priceEUR = await convertToEUR(result.price, result.currency, new Date());

        return {
          assetId: asset.id,
          priceEUR,
        };
      } catch (err) {
        console.error(`Failed to fetch price for ${asset.id}:`, err);
        return {
          assetId: asset.id,
          priceEUR: null,
          notice: err instanceof Error ? err.message : "Quote unavailable",
        };
      }
    });

    const quotes = await Promise.all(quotePromises);

    return Response.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch quotes";
    return Response.json({ error: message }, { status: 502 });
  }
}
