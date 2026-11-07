"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Brush,
} from "recharts";
import type { MonthlyBill } from "@/types";
import { formatMYR, formatKWh } from "@/lib/utils";
import { useTheme } from "@/app/providers";
import {
  ChartDataEditor,
  type ChartDataPoint,
} from "@/components/dashboard/ChartDataEditor";

interface Props {
  data: MonthlyBill[];
  metric: "usage_kwh" | "amount_myr";
}

export function MonthlyChart({ data, metric }: Props) {
  const { theme } = useTheme();
  const sourceData = useMemo(
    () =>
      [...data].slice(-12).map((bill) => ({
        label: format(new Date(bill.year, bill.month - 1, 1), "MMM ''yy"),
        value: metric === "usage_kwh" ? bill.usage_kwh : bill.amount_myr,
      })),
    [data, metric],
  );
  const [chartData, setChartData] = useState(sourceData);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => setChartData(sourceData), [sourceData]);

  const isKwh = metric === "usage_kwh";
  const years = [...new Set(data.slice(-12).map((bill) => bill.year))];
  const yearLabel =
    years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0];
  const chartTitle = `${isKwh ? "Monthly Usage" : "Monthly Bills"}${
    yearLabel ? ` (${yearLabel})` : ""
  }`;

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

  const max = Math.max(...chartData.map((point) => point.value));

  function updatePoint(index: number, point: ChartDataPoint) {
    setChartData((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? point : item,
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
        aria-label={isFullscreen ? "Monthly chart full screen" : undefined}
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
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 20, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme === "dark" ? "#334155" : "#f1f5f9"}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{
              fontSize: 10,
              fill: theme === "dark" ? "#94a3b8" : "#64748b",
            }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            width={74}
            tickMargin={5}
            tick={{
              fontSize: 10,
              fill: theme === "dark" ? "#94a3b8" : "#64748b",
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) =>
              isKwh
                ? `${value}`
                : value >= 1000
                  ? `RM${(value / 1000).toFixed(1)}k`
                  : `RM${Math.round(value)}`
            }
          />
          <Tooltip
            cursor={{ fill: theme === "dark" ? "#1e293b" : "#f8fafc" }}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
              color: theme === "dark" ? "#e2e8f0" : "#0f172a",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              isKwh ? formatKWh(value) : formatMYR(value),
              isKwh ? "Usage" : "Amount",
            ]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => {
              const ratio = entry.value / (max || 1);
              const color =
                ratio < 0.6 ? "#22c55e" : ratio < 0.85 ? "#f59e0b" : "#ef4444";
              return <Cell key={index} fill={color} fillOpacity={0.85} />;
            })}
          </Bar>
          <Brush
            dataKey="label"
            height={24}
            stroke="#3b82f6"
            fill={theme === "dark" ? "#172554" : "#eff6ff"}
            fillOpacity={0.9}
            travellerWidth={12}
            gap={1}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <ChartDataEditor
        points={chartData}
        onChange={updatePoint}
        onReset={() => setChartData(sourceData)}
        valueLabel={isKwh ? "Usage (kWh)" : "Amount (MYR)"}
        filename={isKwh ? "monthly-usage" : "monthly-bills"}
        isEditing={isEditing}
        onToggleEditor={() => setIsEditing((current) => !current)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      </div>
    </div>
  );
}
