"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { MonthlyBill } from "@/types";
import { monthLabel, formatMYR, formatKWh } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DataExportMenu } from "@/components/dashboard/DataExportMenu";

const col = createColumnHelper<MonthlyBill>();

const columns = [
  col.accessor((row) => monthLabel(row.year, row.month), {
    id: "period",
    header: "Period",
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  col.accessor("usage_kwh", {
    header: "Usage",
    cell: (info) =>
      info.row.original.usage_available ? formatKWh(info.getValue()) : "Not provided",
  }),
  col.accessor("billing_no", {
    header: "Bill No.",
    cell: (info) => info.getValue() || "-",
  }),
  col.accessor("amount_myr", {
    header: "Amount (MYR)",
    cell: (info) => (
      <span className="font-semibold tabular-nums">{formatMYR(info.getValue())}</span>
    ),
  }),
  col.accessor("due_date", {
    header: "Due Date",
    cell: (info) => info.getValue() ?? "-",
  }),
  col.accessor("payment_status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      const label = {
        paid: "Paid",
        unpaid: "Unpaid",
        unknown: "Unknown",
        unbilled: "Unbilled",
      }[status] ?? "Unknown";
      const classes = {
        paid: "bg-green-50 text-green-700",
        unpaid: "bg-amber-50 text-amber-700",
        unknown: "bg-slate-100 text-slate-600",
        unbilled: "bg-blue-50 text-blue-700",
      }[status] ?? "bg-slate-100 text-slate-600";
      return (
      <span
        className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", classes)}
      >
        {label}
      </span>
      );
    },
  }),
];

export function BillsTable({ data }: { data: MonthlyBill[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "period", desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-700">Bill history</p>
        <DataExportMenu
          filename="bill-history"
          title="Bill history"
          columns={[
            { header: "Period", key: "period", width: 18 },
            { header: "Usage (kWh)", key: "usage_kwh", width: 16 },
            { header: "Bill No.", key: "billing_no", width: 22 },
            { header: "Amount (MYR)", key: "amount_myr", width: 18 },
            { header: "Due Date", key: "due_date", width: 16 },
            { header: "Status", key: "payment_status", width: 16 },
          ]}
          rows={table.getRowModel().rows.map(({ original }) => ({
            period: monthLabel(original.year, original.month),
            usage_kwh: original.usage_available ? original.usage_kwh : "Not provided",
            billing_no: original.billing_no || "-",
            amount_myr: original.amount_myr,
            due_date: original.due_date ?? "-",
            payment_status: original.payment_status,
          }))}
        />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span className="text-slate-400">
                        {header.column.getIsSorted() === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50",
                i % 2 === 0 ? "" : "bg-slate-50/40",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          No billing data yet - sync an account to get started.
        </div>
      )}
      </div>
    </div>
  );
}
