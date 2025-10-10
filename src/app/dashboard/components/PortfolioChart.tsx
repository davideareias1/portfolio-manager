"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartDataPoint {
  time: string;
  deployed: number;
  current: number;
  ts: number;
  deposit?: boolean;
}

interface PortfolioChartProps {
  chartData: ChartDataPoint[];
  isLoading: boolean;
}

export function PortfolioChart({ chartData, isLoading }: PortfolioChartProps) {
  return (
    <Card className="min-h-0 overflow-hidden flex flex-col h-full">
      <CardHeader className="flex-none border-b py-5">
        <CardTitle>Portfolio Value</CardTitle>
        <CardDescription>
          Track your deployed capital vs. current portfolio value over time
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : chartData.length === 0 ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <div className="h-full w-full min-h-0 min-w-0">
            <ChartContainer
              className="text-foreground aspect-auto h-full min-h-[250px] w-full"
              style={{ minHeight: 250 }}
              config={{
                deployed: { label: "Deployed", color: "hsl(var(--chart-1))" },
                current: { label: "Current Value", color: "hsl(var(--chart-2))" },
              }}
            >
              <AreaChart margin={{ top: 10, right: 12, bottom: 0, left: 12 }} data={chartData}>
                <defs>
                  <linearGradient id="fillDeployed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-deployed)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-deployed)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                {/* Remove grid lines */}
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={chartData.length ? ["dataMin", "dataMax"] : undefined}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(v) => {
                    let ms: number | undefined
                    if (typeof v === "number" && Number.isFinite(v)) {
                      ms = v
                    } else if (typeof v === "string") {
                      const n = Number(v)
                      if (Number.isFinite(n)) {
                        ms = n
                      } else {
                        const parsed = Date.parse(v)
                        if (!Number.isNaN(parsed)) ms = parsed
                      }
                    }
                    if (ms == null) return ""
                    const date = new Date(ms)
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) => `€${(Number(v) / 1000).toFixed(0)}k`}
                  width={60}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value: unknown, payload: any[]) => {
                        // Coerce label to timestamp (ms)
                        let ms: number | undefined
                        if (typeof value === "number" && Number.isFinite(value)) {
                          ms = value
                        } else if (typeof value === "string") {
                          const n = Number(value)
                          if (Number.isFinite(n)) ms = n
                          else {
                            const parsed = Date.parse(value)
                            if (!Number.isNaN(parsed)) ms = parsed
                          }
                        }
                        if (ms == null && Array.isArray(payload) && payload.length) {
                          const p: any = payload[0]?.payload
                          if (p) {
                            if (typeof p.ts === "number") ms = p.ts
                            else if (typeof p.date === "string") {
                              const parsed = Date.parse(p.date)
                              if (!Number.isNaN(parsed)) ms = parsed
                            } else if (typeof p.time === "string") {
                              const parsed = Date.parse(p.time)
                              if (!Number.isNaN(parsed)) ms = parsed
                            }
                          }
                        }
                        if (ms == null) return ""
                        const date = new Date(ms)
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      }}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="deployed"
                  type="monotone"
                  fill="url(#fillDeployed)"
                  stroke="var(--color-deployed)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    style: { fill: "var(--color-deployed)", opacity: 0.8 },
                  }}
                />
                <Area
                  dataKey="current"
                  type="monotone"
                  fill="url(#fillCurrent)"
                  stroke="var(--color-current)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    style: { fill: "var(--color-current)", opacity: 0.8 },
                  }}
                />
                {/* Deposit markers */}
                {chartData.map((p, i) => (
                  p.deposit ? (
                    <ReferenceLine
                      key={`dep-${i}`}
                      x={p.ts}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3"
                      strokeOpacity={0.5}
                      ifOverflow="extendDomain"
                    />
                  ) : null
                ))}
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
