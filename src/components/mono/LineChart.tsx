"use client";

import { useMemo } from "react";

type Point = { x: number; y: number; deposit?: boolean };

export interface LineChartProps {
  points: Point[];
  width?: number;
  height?: number;
}

export function LineChart({ points, width = 800, height = 240 }: LineChartProps) {
  const { path, scaled, scaleX, scaleY } = useMemo(() => {
    if (points.length === 0)
      return {
        path: "",
        scaled: [] as Array<{ x: number; y: number; deposit?: boolean }>,
        scaleX: (x: number) => x,
        scaleY: (y: number) => y,
      };

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);

    const scaleXFn = (x: number) => ((x - minX) / rangeX) * (width - 40) + 20;
    const scaleYFn = (y: number) => height - (((y - minY) / rangeY) * (height - 40) + 20);

    const scaled = points.map((p) => ({
      x: scaleXFn(p.x),
      y: scaleYFn(p.y),
      deposit: p.deposit,
    }));

    let d = "";
    scaled.forEach((p, i) => {
      d += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
    });

    return { path: d, scaled, scaleX: scaleXFn, scaleY: scaleYFn };
  }, [points, width, height]);

  if (!path) return <div className="h-[240px] border border-border" />;

  // Pure black and white only
  return (
    <svg width={width} height={height} role="img" aria-label="Portfolio value chart" className="border border-border bg-background">
      <defs>
        <linearGradient id="mono-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill under the line */}
      {scaled.length >= 2 ? (
        <polygon
          points={`${scaled[0]!.x},${height - 20} ${scaled
            .map((p) => `${p.x},${p.y}`)
            .join(" ")} ${scaled[scaled.length - 1]!.x},${height - 20}`}
          fill="url(#mono-fill)"
          stroke="none"
        />
      ) : null}

      {/* Line path */}
      <path d={path} stroke="#000" strokeWidth={2} fill="none" />

      {/* Deposit markers, correctly scaled */}
      {points.map((p, i) =>
        p.deposit ? (
          <line
            key={`d-${i}`}
            x1={scaleX(p.x)}
            x2={scaleX(p.x)}
            y1={20}
            y2={height - 20}
            stroke="#000"
            strokeDasharray="4 4"
          />
        ) : null
      )}

      {/* Last value marker */}
      {scaled.length ? (
        (() => {
          const last = scaled[scaled.length - 1]!;
          const rawY = points[points.length - 1]!.y;
          const label = rawY.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const cx = last.x;
          const cy = last.y;
          const tx = Math.min(width - 8, cx + 8);
          const ty = Math.max(14, cy - 8);
          return (
            <g>
              <circle cx={cx} cy={cy} r={3} fill="#000" />
              <text x={tx} y={ty} fontSize={10} fill="#000">
                {label}
              </text>
            </g>
          );
        })()
      ) : null}
    </svg>
  );
}
