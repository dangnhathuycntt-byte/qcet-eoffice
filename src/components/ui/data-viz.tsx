"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* HorizontalBarChart                                                         */
/* -------------------------------------------------------------------------- */

export interface HorizontalBarItem {
  label: string;
  value: number;
  highlight?: boolean;
  color?: string;
}

export interface HorizontalBarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: HorizontalBarItem[];
  maxValue?: number;
  labelWidth?: number | string;
}

/**
 * Biểu đồ thanh ngang so sánh giữa các nhóm, xếp giảm dần.
 * Chuẩn QCET: Artboard DataViz (Nhãn bên trái, thanh 12px, giá trị bên phải).
 */
export function HorizontalBarChart({
  data,
  maxValue,
  labelWidth = "240px",
  className,
  ...props
}: HorizontalBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex flex-col gap-2.5 w-full select-none", className)} {...props}>
      {data.map((item, i) => {
        const percentage = Math.min(100, Math.max(0, (item.value / max) * 100));
        const barColor = item.color
          ? item.color
          : item.highlight
            ? "bg-foreground"
            : "bg-muted-foreground/50";

        return (
          <div key={i} className="flex items-center gap-3 text-xs sm:text-sm">
            <span
              style={{ width: typeof labelWidth === "number" ? `${labelWidth}px` : labelWidth }}
              className="truncate text-foreground font-medium shrink-0"
            >
              {item.label}
            </span>
            <div className="relative flex-1 h-3 rounded-full bg-secondary overflow-hidden">
              <div
                style={{ width: `${percentage}%` }}
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
              />
            </div>
            <span className="w-8 text-right font-medium tabular-nums text-foreground shrink-0">
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StackedBarChart                                                            */
/* -------------------------------------------------------------------------- */

export interface StackedBarSegment {
  label: string;
  value: number;
  color: string;
  textColor?: string;
}

export interface StackedBarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: StackedBarSegment[];
  showLegend?: boolean;
}

/**
 * Biểu đồ thanh xếp chồng thể hiện tỷ lệ trong tổng, phân cấp theo độ sáng xám/màu.
 * Chuẩn QCET: Artboard DataViz (Không dùng biểu đồ tròn; thanh cao 36px, bo góc 10px).
 */
export function StackedBarChart({
  segments,
  showLegend = true,
  className,
  ...props
}: StackedBarChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={cn("flex flex-col gap-3 w-full select-none", className)} {...props}>
      <div className="flex h-9 w-full overflow-hidden rounded-[10px] bg-secondary">
        {segments.map((seg, i) => {
          if (seg.value <= 0) return null;
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              className={cn(
                "flex items-center justify-center text-xs font-semibold tabular-nums px-1 transition-all duration-300",
                seg.textColor ? seg.textColor : "text-foreground"
              )}
              title={`${seg.label}: ${seg.value} (${Math.round(pct)}%)`}
            >
              {pct > 5 ? seg.value : ""}
            </div>
          );
        })}
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {segments.map((seg, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <i
                style={{ backgroundColor: seg.color }}
                className="size-2.5 rounded-sm shrink-0 inline-block"
              />
              <span>{seg.label}</span>
              <span className="text-muted-foreground font-normal tabular-nums">
                ({seg.value})
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TrendLine                                                                  */
/* -------------------------------------------------------------------------- */

export interface TrendPoint {
  xLabel: string;
  value: number;
}

export interface TrendLineProps extends React.SVGAttributes<SVGSVGElement> {
  data: TrendPoint[];
  width?: number;
  height?: number;
  lineColor?: string;
  finalLabel?: string;
}

/**
 * Đồ thị đường xu hướng tối giản với dấu chốt điểm cuối và trục thời gian.
 * Chuẩn QCET: Artboard DataViz (Đường mảnh, điểm tròn viền đậm tâm trắng, nhãn điểm cuối).
 */
export function TrendLine({
  data,
  width = 540,
  height = 140,
  lineColor = "currentColor",
  finalLabel,
  className,
  ...props
}: TrendLineProps) {
  if (!data || data.length < 2) return null;

  const padding = { top: 24, right: 30, bottom: 24, left: 10 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values, minVal + 1);

  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1)) * graphWidth;
    const y = padding.top + graphHeight - ((d.value - minVal) / (maxVal - minVal)) * graphHeight;
    return { x, y, value: d.value, label: d.xLabel };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const lastPoint = points[points.length - 1];

  return (
    <div className={cn("flex flex-col w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        {...props}
      >
        {/* Baseline */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--color-bg-hover, var(--border))"
          strokeWidth={1.5}
        />

        {/* Trend line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground"
        />

        {/* Data points */}
        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill="var(--background)"
            stroke="var(--color-text-primary, var(--foreground))"
            strokeWidth={1.5}
          />
        ))}

        {/* Final point label */}
        {lastPoint && (
          <text
            x={lastPoint.x}
            y={lastPoint.y - 8}
            textAnchor="end"
            fontSize="12"
            fontWeight="600"
            className="fill-foreground tabular-nums"
          >
            {finalLabel ?? `${lastPoint.value}`}
          </text>
        )}
      </svg>

      {/* X axis labels */}
      <div className="flex justify-between px-1 text-xs text-muted-foreground font-medium mt-1">
        <span>{data[0]?.xLabel}</span>
        <span>{data[data.length - 1]?.xLabel}</span>
      </div>
    </div>
  );
}
