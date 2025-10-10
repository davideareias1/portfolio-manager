import { NextRequest } from "next/server";

export const revalidate = 60; // 60s cache

export async function GET(_req: NextRequest) {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur";
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return Response.json({ error: "failed" }, { status: 502 });
  const data = (await res.json()) as { bitcoin?: { eur?: number } };
  const price = data.bitcoin?.eur ?? null;
  return Response.json({ assetId: "btc", priceEUR: price, source: "coingecko" });
}
