import { NextRequest } from "next/server";
import { getAssetById } from "@/lib/domain/assets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");
  const tsParam = searchParams.get("timestamp");
  
  if (!assetId || !tsParam) {
    return Response.json({ error: "assetId and timestamp required" }, { status: 400 });
  }
  
  const timestampMs = Number(tsParam);
  if (!Number.isFinite(timestampMs)) {
    return Response.json({ error: "invalid timestamp" }, { status: 400 });
  }

  // Get asset definition
  const asset = getAssetById(assetId);
  if (!asset) {
    return Response.json({ error: `Unknown asset: ${assetId}` }, { status: 400 });
  }

  try {
    const priceEUR = await fetchPriceAt(asset, timestampMs);
    return Response.json({ assetId, priceEUR });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

async function fetchPriceAt(asset: { id: string; quoteSource: string; coingeckoId?: string; yahooSymbol?: string }, timestampMs: number): Promise<number> {
  if (asset.quoteSource === "coingecko") {
    if (!asset.coingeckoId) {
      throw new Error("Missing coingeckoId");
    }
    return await priceBtcAt(timestampMs);
  }
  
  if (asset.quoteSource === "yahoo") {
    if (!asset.yahooSymbol) {
      throw new Error("Missing yahooSymbol");
    }
    const { price, currency } = await priceYahooAt(asset.yahooSymbol, timestampMs);
    return await convertToEUR(price, currency, new Date(timestampMs));
  }
  
  throw new Error(`Unsupported quote source: ${asset.quoteSource}`);
}

async function priceBtcAt(timestampMs: number): Promise<number> {
  const fromSec = Math.floor((timestampMs - 60 * 60 * 1000) / 1000); // 1h window
  const toSec = Math.ceil((timestampMs + 60 * 60 * 1000) / 1000);
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=eur&from=${fromSec}&to=${toSec}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("coingecko failed");
  const data = (await res.json()) as { prices?: [number, number][] };
  const prices = data.prices ?? [];
  if (!prices.length) throw new Error("no prices");
  const target = nearest(prices, timestampMs);
  return target[1];
}

function nearest(prices: [number, number][], targetMs: number): [number, number] {
  let best = prices[0]!;
  let bestDelta = Math.abs(best[0] - targetMs);
  for (const p of prices) {
    const d = Math.abs(p[0] - targetMs);
    if (d < bestDelta) {
      best = p;
      bestDelta = d;
    }
  }
  return best;
}

async function priceYahooAt(symbol: string, timestampMs: number): Promise<{ price: number; currency: string }> {
  const period1 = Math.floor((timestampMs - 24 * 60 * 60 * 1000) / 1000);
  const period2 = Math.ceil((timestampMs + 24 * 60 * 60 * 1000) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit&includePrePost=false`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("yahoo failed");
  type ChartResp = {
    chart?: {
      result?: Array<{
        meta?: { currency?: string };
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
    };
  };
  const json = (await res.json()) as ChartResp;
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("no chart result");
  const currency = result.meta?.currency || "USD";
  const times = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  if (!times.length || !closes.length) throw new Error("no data");
  // Find nearest index by time
  let idx = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i++) {
    const tms = times[i]! * 1000;
    const d = Math.abs(tms - timestampMs);
    if (d < bestDelta) {
      bestDelta = d;
      idx = i;
    }
  }
  const raw = closes[idx];
  if (raw == null) throw new Error("no close price");
  return { price: raw, currency };
}

async function convertToEUR(price: number, currency: string, when: Date): Promise<number> {
  if (currency === "EUR") return price;
  if (currency === "GBp") {
    // Convert pence to pounds first
    const gbp = price / 100;
    const rate = await fxAt("GBP", "EUR", when);
    return gbp * rate;
  }
  if (currency === "GBP") {
    const rate = await fxAt("GBP", "EUR", when);
    return price * rate;
  }
  if (currency === "USD") {
    const rate = await fxAt("USD", "EUR", when);
    return price * rate;
  }
  // Fallback: treat as EUR
  return price;
}

async function fxAt(from: "USD" | "GBP", to: "EUR", when: Date): Promise<number> {
  const ymd = when.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${ymd}?from=${from}&to=${to}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error("fx failed");
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (!rate) throw new Error("no fx rate");
  return rate;
}