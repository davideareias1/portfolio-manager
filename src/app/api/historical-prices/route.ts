import { NextRequest } from "next/server";
import { getAssetById } from "@/lib/domain/assets";
import { fetchHistoricalPrices } from "@/lib/services/priceService";

// Simple in-memory cache with TTL
interface CacheEntry {
  data: HistoricalPrice[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

interface HistoricalPrice {
  timestamp: number;
  price: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  if (!assetId || !startDateParam || !endDateParam) {
    return Response.json(
      { error: "assetId, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  // Get asset definition
  const asset = getAssetById(assetId);
  if (!asset) {
    return Response.json({ error: `Unknown asset: ${assetId}` }, { status: 400 });
  }

  const startDate = new Date(startDateParam);
  const endDate = new Date(endDateParam);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Create cache key
  const cacheKey = `${assetId}:${startDate.toISOString()}:${endDate.toISOString()}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json({ 
      assetId, 
      prices: cached.data,
      cached: true 
    });
  }

  try {
    const prices = await fetchHistoricalPrices(asset, startDate, endDate);

    // Cache the result
    cache.set(cacheKey, {
      data: prices,
      timestamp: Date.now(),
    });

    return Response.json({ 
      assetId, 
      prices,
      cached: false 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
