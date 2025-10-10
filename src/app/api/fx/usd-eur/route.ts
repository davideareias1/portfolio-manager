export const revalidate = 3600; // 1h

export async function GET() {
  const url = "https://api.frankfurter.app/latest?from=USD&to=EUR";
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return Response.json({ error: "failed" }, { status: 502 });
  const data = (await res.json()) as { rates?: { EUR?: number } };
  return Response.json({ usdToEur: data.rates?.EUR ?? null, source: "frankfurter" });
}
