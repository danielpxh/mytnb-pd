"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { DataExportMenu } from "@/components/dashboard/DataExportMenu";

export interface ChartDataPoint {
  label: string;
  value: number;
}

interface Props {
  points: ChartDataPoint[];
  onChange: (index: number, point: ChartDataPoint) => void;
  onReset: () => void;
  valueLabel: string;
  filename: string;
  isEditing: boolean;
  onToggleEditor: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function ChartDataEditor({
  points,
  onChange,
  onReset,
  valueLabel,
  filename,
  isEditing,
  onToggleEditor,
  isFullscreen,
  onToggleFullscreen,
}: Props) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hidden text-xs text-slate-500 sm:block">
          Zoom with the chart range selector. Edits are view-only.
        </p>
        <DataExportMenu
          filename={filename}
          title={valueLabel}
          columns={[
            { header: "Label", key: "label" },
            { header: valueLabel, key: "value" },
          ]}
          rows={points.map(({ label, value }) => ({ label, value }))}
          chartActions={{
            isEditing,
            isFullscreen,
            onToggleEditor,
            onToggleFullscreen,
          }}
        />
      </div>

      {isEditing && (
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Label</th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input
                      aria-label={`Edit label for row ${index + 1}`}
                      value={point.label}
                      onChange={(event) =>
                        onChange(index, { ...point, label: event.target.value })
                      }
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      aria-label={`Edit ${valueLabel} for ${point.label}`}
                      type="number"
                      min="0"
                      step="any"
                      value={point.value}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value) && value >= 0) {
                          onChange(index, { ...point, value });
                        }
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset chart data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
