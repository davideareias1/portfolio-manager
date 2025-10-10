export const revalidate = 3600; // 1h

export async function GET() {
  const url = "https://api.frankfurter.app/latest?from=GBP&to=EUR";
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return Response.json({ error: "failed" }, { status: 502 });
  const data = (await res.json()) as { rates?: { EUR?: number } };
  return Response.json({ gbpToEur: data.rates?.EUR ?? null, source: "frankfurter" });
}
