"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, DollarSign, Calendar, Activity } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useUsageSummary, useDailyUsage, useMonthlyBills } from "@/hooks/useUsage";
import { StatCard } from "@/components/dashboard/StatCard";
import { DailyChart } from "@/components/dashboard/DailyChart";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { DataError } from "@/components/dashboard/DataError";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { formatMYR, formatKWh, monthLabel } from "@/lib/utils";

export default function OverviewPage() {
  const {
    data: accounts = [],
    isLoading: accountsLoading,
    isError: accountsFailed,
    error: accountsError,
  } = useAccounts();
  const [selected, setSelected] = useState<string | undefined>(
    () => accounts[0]?.account_number,
  );

  const accountNumber = selected ?? accounts[0]?.account_number;
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryFailed,
    error: summaryError,
  } = useUsageSummary(accountNumber);
  const {
    data: daily = [],
    isLoading: dailyLoading,
    isError: dailyFailed,
    error: dailyError,
  } = useDailyUsage(accountNumber);
  const {
    data: monthly = [],
    isLoading: monthlyLoading,
    isError: monthlyFailed,
    error: monthlyError,
  } = useMonthlyBills(accountNumber);
  const selectedAccount = accounts.find(
    (account) => account.account_number === accountNumber,
  );

  if (accountsLoading) return <PageSkeleton title="overview" />;

  const bill = summary?.latest_bill;
  const last30 = summary?.last_30_days;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Your electricity at a glance</p>
        </div>
        <AccountSelector
          accounts={accounts}
          selected={accountNumber}
          onSelect={setSelected}
        />
      </div>

      {accountsFailed && (
        <DataError
          message={`Could not load your accounts: ${accountsError.message}`}
        />
      )}
      {summaryFailed && (
        <DataError
          message={`Could not load your usage summary: ${summaryError.message}`}
        />
      )}
      {dailyFailed && (
        <DataError
          message={`Could not load daily usage: ${dailyError.message}`}
        />
      )}
      {monthlyFailed && (
        <DataError
          message={`Could not load bill history: ${monthlyError.message}`}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Latest Bill"
          value={summaryLoading ? "…" : bill ? formatMYR(bill.amount_myr) : "-"}
          subtitle={bill ? monthLabel(bill.year, bill.month) : undefined}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Bill Status"
          value={
            summaryLoading
              ? "…"
              : !bill
              ? "-"
              : bill.payment_status === "paid"
                ? "Paid"
                : bill.payment_status === "unpaid"
                  ? "Unpaid"
                  : bill.payment_status === "unbilled"
                    ? "Unbilled"
                    : "Unknown"
          }
          subtitle={bill?.due_date ? `Due ${bill.due_date}` : undefined}
          icon={<Calendar className="h-4 w-4" />}
        />
        <StatCard
          title="Last 30 Days"
          value={summaryLoading ? "…" : last30 ? formatKWh(last30.total_kwh) : "-"}
          subtitle={last30 ? `${last30.days} days of data` : undefined}
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          title="30-Day Cost"
          value={summaryLoading ? "…" : last30 ? formatMYR(last30.total_myr) : "-"}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {dailyLoading ? (
          <div className="h-52 animate-pulse rounded-xl bg-slate-100" />
        ) : dailyFailed ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center justify-center min-h-[200px] text-sm text-red-700">
            Daily usage could not be loaded. See the error above.
          </div>
        ) : summary?.daily_available && daily.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700">
              Daily Usage - last {daily.length} days
            </p>
            <DailyChart data={daily.slice(-30)} metric="usage_kwh" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-slate-400">
              {selectedAccount && !selectedAccount.is_smart_meter ? (
                <>
                  {selectedAccount.is_tagged_smr === null
                    ? selectedAccount.eligibility_checked_at
                      ? "The account list currently says Standard Meter; myTNB returned no SMR status for this account."
                      : "The account list currently says Standard Meter; its SMR status has not been checked."
                    : "The myTNB SMR status check does not tag this account as a Smart Meter."}{" "}
                  <Link
                    href="/settings#accounts"
                    className="font-medium text-brand-700 underline"
                  >
                    Check meter status in Settings
                  </Link>
                  . Daily kWh readings are provided for accounts tagged as
                  Smart Meter.
                </>
              ) : (
                "Daily data requires available Smart Meter (SMR) readings. Sync this account to fetch them."
              )}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">
            Monthly Bills - last 12 months
          </p>
          {monthlyFailed ? (
            <div className="flex h-40 items-center justify-center text-sm text-red-600">
              Bill history could not be loaded. See the error above.
            </div>
          ) : monthly.length > 0 ? (
            <MonthlyChart data={monthly} metric="amount_myr" />
          ) : monthlyLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
          ) : (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">No billing history yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
