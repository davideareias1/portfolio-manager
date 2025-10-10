import { NextRequest } from "next/server";

// Shorter cache; the dashboard also refreshes every 60s
export const revalidate = 60; // seconds

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });

  try {
    // 1) Try Yahoo v7 quote on both query1 and query2
    const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] as const;
    for (const host of hosts) {
      try {
        const v7 = await getQuoteV7(symbol, host);
        if (isFiniteNumber(v7.price) && v7.currency) {
          return Response.json({ symbol, currency: v7.currency, price: v7.price, source: `yahoo:v7:${host}` });
        }
      } catch {
        // try next host
      }
    }

    // 2) Fallback: Yahoo v8 chart (intraday) – take latest non-null close
    const v8 = await getQuoteFromChart(symbol);
    if (isFiniteNumber(v8.price) && v8.currency) {
      return Response.json({ symbol, currency: v8.currency, price: v8.price, source: "yahoo:v8" });
    }

    return Response.json({ error: "no quote" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function getQuoteV7(
  symbol: string,
  host: "query1.finance.yahoo.com" | "query2.finance.yahoo.com"
): Promise<{ price?: number; currency?: string }> {
  const fields = [
    "currency",
    "regularMarketPrice",
    "preMarketPrice",
    "postMarketPrice",
    "regularMarketTime",
    "marketState",
    "priceHint",
  ].join(",");
  const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}&fields=${fields}&formatted=false&region=US&lang=en-US`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error("yahoo v7 failed");
  type YahooQuoteResponse = {
    quoteResponse?: {
      result?: Array<{
        currency?: string;
        regularMarketPrice?: number;
        preMarketPrice?: number;
        postMarketPrice?: number;
      }>;
    };
  };
  const json = (await res.json()) as YahooQuoteResponse;
  const q = json?.quoteResponse?.result?.[0];
  if (!q) throw new Error("no v7 result");
  const price = q.regularMarketPrice ?? q.preMarketPrice ?? q.postMarketPrice;
  const currency = q.currency;
  return { price, currency };
}

async function getQuoteFromChart(symbol: string): Promise<{ price?: number; currency?: string }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1d&interval=1m&includePrePost=true&lang=en-US&region=US`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error("yahoo v8 failed");
  type ChartResp = {
    chart?: {
      result?: Array<{
        meta?: { currency?: string };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const json = (await res.json()) as ChartResp;
  const r = json.chart?.result?.[0];
  const currency = r?.meta?.currency;
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  // find last non-null close
  let price: number | undefined = undefined;
  for (let i = closes.length - 1; i >= 0; i--) {
    const v = closes[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      price = v;
      break;
    }
  }
  return { price, currency };
}
