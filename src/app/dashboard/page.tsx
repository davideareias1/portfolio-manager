"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import type { DirectoryHandle } from "@/lib/storage/fs";
import { getPersistedDirectory, readJson, writeJson } from "@/lib/storage/fs";
import { Transaction, TransactionSchema } from "@/lib/domain/types";
import { computeSnapshot } from "@/lib/domain/calculations";
import { DEFAULT_ASSETS } from "@/lib/domain/assets";
import { generateDailyChartData, parseHistoricalPrices, mergeHistoricalPrices } from "@/lib/domain/chartData";
import { StatsCards } from "./components/StatsCards";
import { AddTransactionForm } from "./components/AddTransactionForm";
import { PortfolioChart } from "./components/PortfolioChart";
import { TransactionsTable } from "./components/TransactionsTable";

interface CurrentPrices {
  [assetId: string]: number;
}

interface HistoricalPriceData {
  [assetId: string]: Map<number, number>;
}

const TX_PATH = "transactions.json";

export default function DashboardPage() {
  const [dir, setDir] = useState<DirectoryHandle | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prices, setPrices] = useState<CurrentPrices>({});
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPriceData>({});
  const [view, setView] = useState<"graph" | "transactions">("graph");
  const [isTxLoading, setIsTxLoading] = useState(true);
  const [isPricesLoading, setIsPricesLoading] = useState(true);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(true);
  const isBootstrapping = isTxLoading || isPricesLoading || isHistoricalLoading;

  useEffect(() => {
    (async () => {
      try {
        const d = await getPersistedDirectory();
        if (d) {
          setDir(d);
          const txs = await readJson<Transaction[]>(d, TX_PATH, []);
          setTransactions(txs);
        }
      } finally {
        setIsTxLoading(false);
      }
    })();
  }, []);

  const snapshot = useMemo(() => computeSnapshot(transactions, prices), [transactions, prices]);

  const chartData = useMemo(() => {
    return generateDailyChartData(transactions, prices, historicalPrices);
  }, [transactions, prices, historicalPrices]);

  async function addTransaction(formData: FormData) {
    if (!dir) {
      toast.error("Select data folder first");
      return;
    }
    try {
      const assetId = String(formData.get("assetId"));
      const timestamp = new Date(String(formData.get("timestamp"))).getTime();
      const quantityInput = Number(formData.get("quantity"));
      
      // Auto-fetch price per unit at timestamp
      const priceResp = await fetch(`/api/price-at?assetId=${encodeURIComponent(assetId)}&timestamp=${timestamp}`);
      const priceJson = await priceResp.json();
      if (!priceResp.ok || !priceJson.priceEUR) throw new Error("Failed to fetch price");
      const pricePerUnitEUR = Number(priceJson.priceEUR);
      const decimals = DEFAULT_ASSETS[assetId]?.decimals ?? 4;
      const factor = Math.pow(10, decimals);
      const quantity = Math.round(quantityInput * factor) / factor;
      const t: Transaction = TransactionSchema.parse({
        id: crypto.randomUUID(),
        assetId,
        timestamp,
        quantity,
        pricePerUnitEUR,
      });
      const next = [...transactions, t];
      await writeJson(dir, TX_PATH, next);
      setTransactions(next);
      toast.success("Transaction added");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid input";
      toast.error(message);
    }
  }

  async function deleteTransaction(transactionId: string) {
    if (!dir) return;
    const next = transactions.filter((x) => x.id !== transactionId);
    await writeJson(dir, TX_PATH, next);
    setTransactions(next);
  }



  async function refreshPrices(options?: { silent?: boolean }) {
    try {
      const res = await fetch("/api/quotes/all");
      if (!res.ok) throw new Error("Failed to fetch quotes");
      
      const data = await res.json();
      const quotes: Array<{ assetId: string; priceEUR: number | null; notice?: string }> = data.quotes || [];

      const next: CurrentPrices = { ...prices };
      const notices: string[] = [];
      let updated = false;

      for (const quote of quotes) {
        if (quote.priceEUR !== null && quote.priceEUR > 0) {
          next[quote.assetId] = quote.priceEUR;
          updated = true;
        }
        if (quote.notice) {
          notices.push(quote.notice);
        }
      }

      if (updated) {
        setPrices(next);
        if (!options?.silent) {
          if (notices.length) {
            toast.message("Prices partially updated", { id: "prices-refresh", description: notices.join("; ") });
          } else {
            toast.success("Prices updated", { id: "prices-refresh" });
          }
        }
      } else {
        if (!options?.silent) {
          throw new Error(notices.join("; ") || "Failed to update prices");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update prices";
      if (!options?.silent) toast.error(message, { id: "prices-refresh" });
    }
  }

  useEffect(() => {
    // Fetch immediately and then on a 60s interval (silent to avoid duplicate toasts in dev)
    let cancelled = false;
    (async () => {
      await refreshPrices({ silent: true });
      if (!cancelled) setIsPricesLoading(false);
    })();
    const id = setInterval(() => {
      refreshPrices({ silent: true });
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch historical prices when transactions change
  useEffect(() => {
    if (transactions.length === 0) {
      setIsHistoricalLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Get unique asset IDs from transactions
        const assetIds = Array.from(new Set(transactions.map(t => t.assetId)));
        
        // Calculate date range
        const sortedTx = transactions.slice().sort((a, b) => a.timestamp - b.timestamp);
        const startDate = new Date(sortedTx[0]!.timestamp);
        const endDate = new Date();

        // Fetch historical prices for each asset
        const historicalDatasets = await Promise.all(
          assetIds.map(async (assetId) => {
            try {
              const params = new URLSearchParams({
                assetId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
              });

              const res = await fetch(`/api/historical-prices?${params}`);
              if (!res.ok) {
                console.warn(`Failed to fetch historical prices for ${assetId}`);
                return {};
              }

              const data = await res.json();
              if (data.prices && Array.isArray(data.prices)) {
                return parseHistoricalPrices(assetId, data.prices);
              }
              return {};
            } catch (err) {
              console.warn(`Error fetching historical prices for ${assetId}:`, err);
              return {};
            }
          })
        );

        if (!cancelled) {
          const merged = mergeHistoricalPrices(...historicalDatasets);
          setHistoricalPrices(merged);
          setIsHistoricalLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch historical prices:", err);
        if (!cancelled) {
          setIsHistoricalLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  // Normalize any existing transactions to asset-specific decimals on first load
  useEffect(() => {
    (async () => {
      if (!dir || transactions.length === 0) return;
      let changed = false;
      const normalized = transactions.map((t) => {
        const decimals = DEFAULT_ASSETS[t.assetId]?.decimals ?? 4;
        const factor = Math.pow(10, decimals);
        const roundedQty = Math.round(t.quantity * factor) / factor;
        if (roundedQty !== t.quantity) changed = true;
        return { ...t, quantity: roundedQty };
      });
      if (changed) {
        await writeJson(dir, TX_PATH, normalized);
        setTransactions(normalized);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, transactions]);

  return (
    <main className="max-w-6xl mx-auto h-dvh grid grid-rows-[auto_1fr] gap-3 px-3 py-3">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/">← Back</Link>
        </Button>
        <Button variant="outline" onClick={() => refreshPrices()}>
          Refresh Prices
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={view === "graph" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("graph")}
          >
            Graph
          </Button>
          <Button
            variant={view === "transactions" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("transactions")}
          >
            Transactions
          </Button>
        </div>
      </div>

      <section className="min-h-0 h-full grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <StatsCards snapshot={snapshot} isLoading={isBootstrapping} />

        {view === "transactions" && (
          <div className="min-h-0">
            <AddTransactionForm onSubmit={addTransaction} />
          </div>
        )}

        {view === "graph" ? (
          <PortfolioChart chartData={chartData} isLoading={isBootstrapping} />
        ) : (
          <TransactionsTable
            transactions={transactions}
            prices={prices}
            isLoading={isBootstrapping}
            onDelete={deleteTransaction}
          />
        )}
      </section>
    </main>
  );
}
