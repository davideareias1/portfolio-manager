import { AssetId, AssetPosition, PortfolioSnapshot, PortfolioTotals, Transaction } from "./types";

export function accumulatePositions(transactions: Transaction[]): Map<AssetId, AssetPosition> {
  const map = new Map<AssetId, AssetPosition>();
  for (const t of transactions) {
    const current = map.get(t.assetId) ?? {
      assetId: t.assetId,
      quantityHeld: 0,
      deployedCapitalEUR: 0,
    };
    current.quantityHeld += t.quantity;
    current.deployedCapitalEUR += t.quantity * t.pricePerUnitEUR;
    map.set(t.assetId, current);
  }
  return map;
}

export function computeSnapshot(
  transactions: Transaction[],
  currentPricesEUR: Record<AssetId, number>
): PortfolioSnapshot {
  const positions = accumulatePositions(transactions);
  const assets: PortfolioSnapshot["assets"] = [];

  let totalCurrent = 0;
  let totalDeployed = 0;

  for (const [assetId, position] of positions) {
    const currentPrice = currentPricesEUR[assetId] ?? 0;
    const currentValue = position.quantityHeld * currentPrice;

    totalCurrent += currentValue;
    totalDeployed += position.deployedCapitalEUR;

    assets.push({
      assetId,
      currentPriceEUR: round2(currentPrice),
      currentValueEUR: round2(currentValue),
      position: {
        assetId: position.assetId,
        quantityHeld: round4(position.quantityHeld),
        deployedCapitalEUR: round2(position.deployedCapitalEUR),
      },
    });
  }

  const profit = totalCurrent - totalDeployed;
  const totals: PortfolioTotals = {
    deployedCapitalEUR: round2(totalDeployed),
    currentValueEUR: round2(totalCurrent),
    profitEUR: round2(profit),
    returnPct: totalDeployed > 0 ? profit / totalDeployed : 0,
  };

  return { assets, totals };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
