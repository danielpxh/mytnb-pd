"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";
import type { DailyUsage } from "@/types";
import { isoDateToLabel, formatKWh, formatMYR } from "@/lib/utils";
import { useTheme } from "@/app/providers";
import {
  ChartDataEditor,
  type ChartDataPoint,
} from "@/components/dashboard/ChartDataEditor";

interface Props {
  data: DailyUsage[];
  metric: "usage_kwh" | "cost_myr";
}

export function DailyChart({ data, metric }: Props) {
  const { theme } = useTheme();
  const sourceData = useMemo(
    () =>
      data.map((d) => ({
        date: isoDateToLabel(d.date),
        value: metric === "usage_kwh" ? d.usage_kwh : d.cost_myr,
      })),
    [data, metric],
  );
  const [chartData, setChartData] = useState(sourceData);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => setChartData(sourceData), [sourceData]);

  const years = [...new Set(data.map((entry) => entry.date.slice(0, 4)))];
  const yearLabel =
    years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0];
  const chartTitle = `Daily Usage${yearLabel ? ` (${yearLabel})` : ""}`;

  const closeFullscreen = useCallback(() => {
    if (
      isEditing &&
      !window.confirm(
        "The chart data editor is open. Close full screen? Your chart edits will remain in this view.",
      )
    ) {
      return;
    }
    setIsFullscreen(false);
  }, [isEditing]);

  function toggleFullscreen() {
    if (isFullscreen) closeFullscreen();
    else setIsFullscreen(true);
  }

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeFullscreen, isFullscreen]);

  const isKwh = metric === "usage_kwh";
  const color = isKwh ? "#3b82f6" : "#8b5cf6";
  const formatter = isKwh ? formatKWh : formatMYR;
  const editorPoints: ChartDataPoint[] = chartData.map(({ date, value }) => ({
    label: date,
    value,
  }));

  function updatePoint(index: number, point: ChartDataPoint) {
    setChartData((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index
          ? { date: point.label, value: point.value }
          : item,
      ),
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-950/60 p-3 sm:p-8"
          : undefined
      }
    >
      <div
        role={isFullscreen ? "dialog" : undefined}
        aria-modal={isFullscreen ? true : undefined}
        aria-label={isFullscreen ? "Daily chart full screen" : undefined}
        className={
          isFullscreen
            ? "flex h-full flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
            : undefined
        }
      >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-sm font-semibold text-slate-800 sm:text-base">
          {chartTitle}
        </h2>
        {isFullscreen && (
          <button
            type="button"
            onClick={closeFullscreen}
            aria-label="Close full-screen chart"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        )}
      </div>
      <div className={isFullscreen ? "h-[min(68vh,720px)] shrink-0" : "h-[280px]"}>
      <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={theme === "dark" ? "#334155" : "#f1f5f9"}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          width={74}
          tickMargin={5}
          tick={{ fontSize: 10, fill: theme === "dark" ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            isKwh
              ? `${v}`
              : v >= 1000
                ? `RM${(v / 1000).toFixed(1)}k`
                : `RM${Math.round(v)}`
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
            backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
            color: theme === "dark" ? "#e2e8f0" : "#0f172a",
            fontSize: 12,
          }}
          formatter={(value: number) => [formatter(value), isKwh ? "Usage" : "Cost"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${metric})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Brush
          dataKey="date"
          height={24}
          stroke="#3b82f6"
          fill={theme === "dark" ? "#172554" : "#eff6ff"}
          fillOpacity={0.9}
          travellerWidth={12}
          gap={1}
        />
      </AreaChart>
      </ResponsiveContainer>
      </div>
      <ChartDataEditor
        points={editorPoints}
        onChange={updatePoint}
        onReset={() => setChartData(sourceData)}
        valueLabel={isKwh ? "Usage (kWh)" : "Cost (MYR)"}
        filename={isKwh ? "daily-usage" : "daily-cost"}
        isEditing={isEditing}
        onToggleEditor={() => setIsEditing((current) => !current)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      </div>
    </div>
  );
}
