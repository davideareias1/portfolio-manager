import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Transaction } from "@/lib/domain/types";
import { DEFAULT_ASSETS } from "@/lib/domain/assets";
import { formatDateUTC } from "./utils";

interface CurrentPrices {
  [assetId: string]: number;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  prices: CurrentPrices;
  isLoading: boolean;
  onDelete: (transactionId: string) => Promise<void>;
}

export function TransactionsTable({ transactions, prices, isLoading, onDelete }: TransactionsTableProps) {
  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent className="h-full grid grid-rows-[auto_1fr] gap-2 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="min-h-0 overflow-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price EUR</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto rounded-sm" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="min-h-0 overflow-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price EUR</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => {
                  const pnl = (prices[t.assetId] ?? 0) * t.quantity - (t.quantity * t.pricePerUnitEUR);
                  const sign = pnl >= 0 ? "+" : "-";
                  const pnlClass = pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-600" : "";
                  const qtyDecimals = DEFAULT_ASSETS[t.assetId]?.decimals ?? 4;
                  const qtyDisplay = Number(t.quantity).toFixed(qtyDecimals);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>{t.assetId}</TableCell>
                      <TableCell>{formatDateUTC(new Date(t.timestamp))}</TableCell>
                      <TableCell className="text-right">{qtyDisplay}</TableCell>
                      <TableCell className="text-right">{t.pricePerUnitEUR.toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${pnlClass}`}>{sign}€ {Math.abs(pnl).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(t.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
