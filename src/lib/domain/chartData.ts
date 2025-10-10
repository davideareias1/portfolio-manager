import { Transaction } from "./types";

interface ChartDataPoint {
  time: string;
  deployed: number;
  current: number;
  ts: number;
  deposit?: boolean;
}

interface PortfolioState {
  positions: Map<string, { quantity: number; deployed: number }>;
  deployedTotal: number;
}

interface HistoricalPriceData {
  [assetId: string]: Map<number, number>; // timestamp -> price mapping
}

/**
 * Generates daily chart data points with real market data from APIs.
 * This function now accepts historical price data fetched from the backend.
 */
export function generateDailyChartData(
  transactions: Transaction[],
  currentPrices: Record<string, number>,
  historicalPrices?: HistoricalPriceData
): ChartDataPoint[] {
  if (transactions.length === 0) {
    return [];
  }

  const sorted = transactions.slice().sort((a, b) => a.timestamp - b.timestamp);
  const firstDate = sorted[0]!.timestamp;
  const lastDate = Date.now();
  
  // Create a map of transaction dates for marking deposits
  const transactionDates = new Set(
    sorted.map(t => {
      const d = new Date(t.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  const points: ChartDataPoint[] = [];
  const positions = new Map<string, { quantity: number; deployed: number }>();
  let transactionIndex = 0;
  
  // Start from the first transaction date
  const startDate = new Date(firstDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(lastDate);
  endDate.setHours(0, 0, 0, 0);
  
  // Generate daily points
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayTimestamp = date.getTime();
    const nextDayTimestamp = dayTimestamp + 24 * 60 * 60 * 1000;
    
    // Process all transactions up to and including this day
    while (transactionIndex < sorted.length && sorted[transactionIndex]!.timestamp < nextDayTimestamp) {
      const t = sorted[transactionIndex]!;
      const prev = positions.get(t.assetId) ?? { quantity: 0, deployed: 0 };
      const deployedAdd = t.quantity * t.pricePerUnitEUR;
      positions.set(t.assetId, {
        quantity: prev.quantity + t.quantity,
        deployed: prev.deployed + deployedAdd,
      });
      transactionIndex++;
    }
    
    // Calculate totals for this day
    let deployedTotal = 0;
    for (const [, pos] of positions) {
      deployedTotal += pos.deployed;
    }
    
    // Skip days before we have any positions
    if (deployedTotal === 0) {
      continue;
    }
    
    const state: PortfolioState = { positions, deployedTotal };
    const currentTotal = calculatePortfolioValueAtTime(
      state,
      dayTimestamp,
      currentPrices,
      historicalPrices
    );
    
    points.push({
      time: date.toLocaleDateString(),
      ts: dayTimestamp,
      deployed: deployedTotal,
      current: currentTotal,
      deposit: transactionDates.has(dayTimestamp),
    });
  }
  
  return points;
}

/**
 * Calculates the portfolio value at a specific timestamp using real historical prices.
 */
function calculatePortfolioValueAtTime(
  state: PortfolioState,
  timestamp: number,
  currentPrices: Record<string, number>,
  historicalPrices?: HistoricalPriceData
): number {
  let total = 0;
  
  for (const [assetId, pos] of state.positions) {
    if (pos.quantity === 0) continue;
    
    let priceAtTime: number | undefined;
    
    // Try to get historical price first
    if (historicalPrices && historicalPrices[assetId]) {
      priceAtTime = findNearestPrice(historicalPrices[assetId]!, timestamp);
    }
    
    // Fallback to current price if no historical data
    if (!priceAtTime) {
      priceAtTime = currentPrices[assetId];
    }
    
    if (priceAtTime && priceAtTime > 0) {
      total += pos.quantity * priceAtTime;
    }
  }
  
  // If we still don't have any price data, use deployed capital
  if (total === 0 && state.deployedTotal > 0) {
    total = state.deployedTotal;
  }
  
  return total;
}

/**
 * Finds the nearest price to a given timestamp from a price map.
 */
function findNearestPrice(priceMap: Map<number, number>, targetTimestamp: number): number | undefined {
  if (priceMap.size === 0) return undefined;
  
  // Get all timestamps
  const timestamps = Array.from(priceMap.keys()).sort((a, b) => a - b);
  
  // If target is before first timestamp, use first price
  if (targetTimestamp <= timestamps[0]!) {
    return priceMap.get(timestamps[0]!);
  }
  
  // If target is after last timestamp, use last price
  if (targetTimestamp >= timestamps[timestamps.length - 1]!) {
    return priceMap.get(timestamps[timestamps.length - 1]!);
  }
  
  // Find nearest timestamp
  let nearestTimestamp = timestamps[0]!;
  let minDiff = Math.abs(targetTimestamp - nearestTimestamp);
  
  for (const ts of timestamps) {
    const diff = Math.abs(targetTimestamp - ts);
    if (diff < minDiff) {
      minDiff = diff;
      nearestTimestamp = ts;
    }
  }
  
  return priceMap.get(nearestTimestamp);
}

/**
 * Helper function to convert API response to HistoricalPriceData format.
 */
export function parseHistoricalPrices(
  assetId: string,
  prices: Array<{ timestamp: number; price: number }>
): HistoricalPriceData {
  const priceMap = new Map<number, number>();
  
  for (const { timestamp, price } of prices) {
    // Normalize to start of day
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    priceMap.set(date.getTime(), price);
  }
  
  return {
    [assetId]: priceMap,
  };
}

/**
 * Merges multiple HistoricalPriceData objects into one.
 */
export function mergeHistoricalPrices(...datasets: HistoricalPriceData[]): HistoricalPriceData {
  const result: HistoricalPriceData = {};
  
  for (const dataset of datasets) {
    for (const [assetId, priceMap] of Object.entries(dataset)) {
      if (!result[assetId]) {
        result[assetId] = new Map();
      }
      for (const [timestamp, price] of priceMap.entries()) {
        result[assetId]!.set(timestamp, price);
      }
    }
  }
  
  return result;
}
