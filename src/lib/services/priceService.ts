import { AssetDefinition } from "../domain/types";

/**
 * Currency conversion service
 */
export async function convertToEUR(
  price: number,
  currency: string,
  when: Date
): Promise<number> {
  if (currency === "EUR") return price;
  
  if (currency === "GBp" || currency === "GBX") {
    // Convert pence to pounds first
    const gbp = price / 100;
    const rate = await getFxRate("GBP", "EUR", when);
    return gbp * rate;
  }
  
  if (currency === "GBP") {
    const rate = await getFxRate("GBP", "EUR", when);
    return price * rate;
  }
  
  if (currency === "USD") {
    const rate = await getFxRate("USD", "EUR", when);
    return price * rate;
  }
  
  // Fallback: treat as EUR
  console.warn(`Unknown currency ${currency}, treating as EUR`);
  return price;
}

// FX rate cache
const fxCache = new Map<string, { rate: number; timestamp: number }>();
const FX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getFxRate(
  from: "USD" | "GBP",
  to: "EUR",
  when: Date
): Promise<number> {
  const ymd = when.toISOString().slice(0, 10);
  const cacheKey = `${from}:${to}:${ymd}`;
  
  // Check cache
  const cached = fxCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FX_CACHE_TTL) {
    return cached.rate;
  }
  
  const url = `https://api.frankfurter.app/${ymd}?from=${from}&to=${to}`;
  const res = await fetch(url, { 
    next: { revalidate: 86400 } // Cache for 24 hours
  });
  
  if (!res.ok) {
    throw new Error(`FX API failed: ${res.status}`);
  }
  
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];
  
  if (!rate) {
    throw new Error("No FX rate available");
  }
  
  // Cache the rate
  fxCache.set(cacheKey, {
    rate,
    timestamp: Date.now(),
  });
  
  return rate;
}

/**
 * Fetch current price for an asset
 */
export async function fetchCurrentPrice(
  asset: AssetDefinition
): Promise<{ price: number; currency: string } | null> {
  try {
    if (asset.quoteSource === "coingecko") {
      if (!asset.coingeckoId) {
        throw new Error("Missing coingeckoId for CoinGecko asset");
      }
      return await fetchCoinGeckoPrice(asset.coingeckoId);
    }
    
    if (asset.quoteSource === "yahoo") {
      if (!asset.yahooSymbol) {
        throw new Error("Missing yahooSymbol for Yahoo asset");
      }
      return await fetchYahooPrice(asset.yahooSymbol);
    }
    
    throw new Error(`Unsupported quote source: ${asset.quoteSource}`);
  } catch (err) {
    console.error(`Failed to fetch price for ${asset.id}:`, err);
    return null;
  }
}

async function fetchCoinGeckoPrice(
  coingeckoId: string
): Promise<{ price: number; currency: string }> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=eur`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  
  if (!res.ok) {
    throw new Error(`CoinGecko API failed: ${res.status}`);
  }
  
  const data = (await res.json()) as Record<string, { eur?: number }>;
  const price = data[coingeckoId]?.eur;
  
  if (!price) {
    throw new Error("No price data available");
  }
  
  return { price, currency: "EUR" };
}

async function fetchYahooPrice(
  symbol: string
): Promise<{ price: number; currency: string }> {
  // Try v7 quote first
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] as const;
  
  for (const host of hosts) {
    try {
      const result = await fetchYahooQuoteV7(symbol, host);
      if (result) return result;
    } catch {
      // Try next host
    }
  }
  
  // Fallback to v8 chart
  return await fetchYahooQuoteFromChart(symbol);
}

async function fetchYahooQuoteV7(
  symbol: string,
  host: "query1.finance.yahoo.com" | "query2.finance.yahoo.com"
): Promise<{ price: number; currency: string } | null> {
  const fields = [
    "currency",
    "regularMarketPrice",
    "preMarketPrice",
    "postMarketPrice",
  ].join(",");
  
  const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}&fields=${fields}&formatted=false&region=US&lang=en-US`;
  
  const res = await fetch(url, { next: { revalidate: 60 } });
  
  if (!res.ok) {
    throw new Error("Yahoo v7 failed");
  }
  
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
  const quote = json?.quoteResponse?.result?.[0];
  
  if (!quote) {
    return null;
  }
  
  const price = quote.regularMarketPrice ?? quote.preMarketPrice ?? quote.postMarketPrice;
  const currency = quote.currency;
  
  if (typeof price === "number" && Number.isFinite(price) && currency) {
    return { price, currency };
  }
  
  return null;
}

async function fetchYahooQuoteFromChart(
  symbol: string
): Promise<{ price: number; currency: string }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1d&interval=1m&includePrePost=true&lang=en-US&region=US`;
  
  const res = await fetch(url, { next: { revalidate: 60 } });
  
  if (!res.ok) {
    throw new Error("Yahoo v8 failed");
  }
  
  type ChartResp = {
    chart?: {
      result?: Array<{
        meta?: { currency?: string };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  
  const json = (await res.json()) as ChartResp;
  const result = json.chart?.result?.[0];
  const currency = result?.meta?.currency;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  
  // Find last non-null close
  let price: number | undefined;
  for (let i = closes.length - 1; i >= 0; i--) {
    const v = closes[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      price = v;
      break;
    }
  }
  
  if (!price || !currency) {
    throw new Error("No price data available");
  }
  
  return { price, currency };
}

/**
 * Fetch historical prices for an asset
 */
export async function fetchHistoricalPrices(
  asset: AssetDefinition,
  startDate: Date,
  endDate: Date
): Promise<Array<{ timestamp: number; price: number }>> {
  if (asset.quoteSource === "coingecko") {
    if (!asset.coingeckoId) {
      throw new Error("Missing coingeckoId for CoinGecko asset");
    }
    return await fetchCoinGeckoHistoricalPrices(asset.coingeckoId, startDate, endDate);
  }
  
  if (asset.quoteSource === "yahoo") {
    if (!asset.yahooSymbol) {
      throw new Error("Missing yahooSymbol for Yahoo asset");
    }
    return await fetchYahooHistoricalPrices(asset.yahooSymbol, startDate, endDate);
  }
  
  throw new Error(`Unsupported quote source: ${asset.quoteSource}`);
}

async function fetchCoinGeckoHistoricalPrices(
  coingeckoId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ timestamp: number; price: number }>> {
  const fromSec = Math.floor(startDate.getTime() / 1000);
  const toSec = Math.ceil(endDate.getTime() / 1000);
  
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range?vs_currency=eur&from=${fromSec}&to=${toSec}`;
  
  const res = await fetch(url, { 
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  
  if (!res.ok) {
    throw new Error(`CoinGecko API failed: ${res.status}`);
  }
  
  const data = (await res.json()) as { prices?: [number, number][] };
  const prices = data.prices ?? [];
  
  if (!prices.length) {
    throw new Error("No price data available");
  }

  return aggregateByDay(
    prices.map(([timestamp, price]) => ({
      timestamp,
      price,
    }))
  );
}

async function fetchYahooHistoricalPrices(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ timestamp: number; price: number }>> {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.ceil(endDate.getTime() / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit&includePrePost=false`;
  
  const res = await fetch(url, { 
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  
  if (!res.ok) {
    throw new Error(`Yahoo Finance API failed: ${res.status}`);
  }
  
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
  
  if (!result) {
    throw new Error("No chart data available");
  }
  
  const currency = result.meta?.currency || "USD";
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  
  if (!timestamps.length || !closes.length) {
    throw new Error("No price data available");
  }

  // Convert to EUR if necessary
  const prices: Array<{ timestamp: number; price: number }> = [];
  
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    
    const timestamp = timestamps[i]! * 1000; // Convert to milliseconds
    const priceEUR = await convertToEUR(close, currency, new Date(timestamp));
    
    prices.push({
      timestamp,
      price: priceEUR,
    });
  }
  
  return prices;
}

function aggregateByDay(
  prices: Array<{ timestamp: number; price: number }>
): Array<{ timestamp: number; price: number }> {
  const byDay = new Map<string, Array<{ timestamp: number; price: number }>>();
  
  for (const price of prices) {
    const date = new Date(price.timestamp);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    
    if (!byDay.has(key)) {
      byDay.set(key, []);
    }
    byDay.get(key)!.push(price);
  }
  
  // Take the last price of each day
  const result: Array<{ timestamp: number; price: number }> = [];
  for (const [, dayPrices] of byDay) {
    const sorted = dayPrices.sort((a, b) => a.timestamp - b.timestamp);
    result.push(sorted[sorted.length - 1]!);
  }
  
  return result.sort((a, b) => a.timestamp - b.timestamp);
}
