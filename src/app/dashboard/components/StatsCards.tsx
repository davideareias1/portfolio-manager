import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Snapshot {
  totals: {
    deployedCapitalEUR: number;
    currentValueEUR: number;
    profitEUR: number;
    returnPct: number;
  };
}

interface StatsCardsProps {
  snapshot: Snapshot;
  isLoading: boolean;
}

export function StatsCards({ snapshot, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Deployed Capital</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl">
          {isLoading ? (
            <Skeleton className="h-7 w-36" />
          ) : (
            <>€ {snapshot.totals.deployedCapitalEUR.toFixed(2)}</>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current Value</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl">
          {isLoading ? (
            <Skeleton className="h-7 w-36" />
          ) : (
            <>€ {snapshot.totals.currentValueEUR.toFixed(2)}</>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Profit / Return</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl">
          {isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            (() => {
              const profit = snapshot.totals.profitEUR;
              const color = profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "";
              const sign = profit >= 0 ? "+" : "-";
              return (
                <span className={color}>
                  {sign}€ {Math.abs(profit).toFixed(2)} ({(snapshot.totals.returnPct * 100).toFixed(2)}%)
                </span>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
