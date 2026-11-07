"use client";

import { useState } from "react";
import {
  Download,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportData,
  type ExportColumn,
  type ExportFormat,
  type ExportRow,
} from "@/lib/export";

interface Props {
  filename: string;
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  chartActions?: {
    isEditing: boolean;
    isFullscreen: boolean;
    onToggleEditor: () => void;
    onToggleFullscreen: () => void;
  };
}

const formats: { value: ExportFormat; label: string }[] = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "docx", label: "Word (.docx)" },
  { value: "pdf", label: "PDF (.pdf)" },
  { value: "csv", label: "CSV (.csv)" },
];

export function DataExportMenu({
  filename,
  title,
  columns,
  rows,
  chartActions,
}: Props) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );

  async function handleExport(selectedFormat: ExportFormat) {
    setIsExporting(true);
    setExportingFormat(selectedFormat);
    try {
      await exportData(selectedFormat, filename, title, columns, rows);
      toast.success(`${title} exported as ${selectedFormat.toUpperCase()}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not export ${title}.`,
      );
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  }

  if (chartActions) {
    return (
      <details className="group relative">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <Ellipsis className="h-4 w-4" />
          <span>Chart actions</span>
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button
            type="button"
            onClick={chartActions.onToggleFullscreen}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            {chartActions.isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {chartActions.isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button
            type="button"
            onClick={chartActions.onToggleEditor}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            {chartActions.isEditing ? "Close data editor" : "Edit chart data"}
          </button>
          <div className="my-1 border-t border-slate-100 pt-1">
            <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Export chart data
            </p>
            {formats.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => void handleExport(value)}
                disabled={isExporting || rows.length === 0}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {value === "xlsx" ? (
                  <FileSpreadsheet className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {exportingFormat === value ? "Exporting…" : label}
              </button>
            ))}
          </div>
        </div>
      </details>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <label className="sr-only" htmlFor={`export-${filename}`}>
        Export format for {title}
      </label>
      <select
        id={`export-${filename}`}
        value={format}
        onChange={(event) => {
          const selected = formats.find(
            (item) => item.value === event.target.value,
          );
          if (selected) setFormat(selected.value);
        }}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600"
      >
        {formats.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleExport(format)}
        disabled={isExporting || rows.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {isExporting ? "Exporting…" : "Export"}
      </button>
    </div>
  );
}
