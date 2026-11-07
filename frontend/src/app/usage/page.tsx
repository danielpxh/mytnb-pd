"use client";

import { useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useDailyUsage } from "@/hooks/useUsage";
import { DailyChart } from "@/components/dashboard/DailyChart";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { DataError } from "@/components/dashboard/DataError";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";

type Metric = "usage_kwh" | "cost_myr";

export default function UsagePage() {
  const {
    data: accounts = [],
    isLoading: accountsLoading,
    isError: accountsFailed,
    error: accountsError,
  } = useAccounts();
  const [selected, setSelected] = useState<string | undefined>(
    () => accounts[0]?.account_number,
  );
  const [metric, setMetric] = useState<Metric>("usage_kwh");
  const accountNumber = selected ?? accounts[0]?.account_number;
  const {
    data: daily = [],
    isLoading,
    isError: usageFailed,
    error: usageError,
  } = useDailyUsage(accountNumber);
  const selectedAccount = accounts.find(
    (account) => account.account_number === accountNumber,
  );

  if (accountsLoading) {
    return <PageSkeleton title="daily usage" cards={0} charts={1} />;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Usage</h1>
          <p className="text-sm text-slate-500">Smart meter data (SMR accounts only)</p>
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
      {usageFailed && (
        <DataError
          message={`Could not load usage data: ${usageError.message}`}
        />
      )}

      {/* Metric toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {(["usage_kwh", "cost_myr"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
              metric === m
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {m === "usage_kwh" ? "kWh" : "Cost (MYR)"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-50">
          </div>
        ) : usageFailed ? (
          <div className="h-64 flex items-center justify-center text-sm text-red-600">
            Usage data could not be loaded. See the error above.
          </div>
        ) : daily.length > 0 ? (
          <>
            <p className="mb-4 text-sm font-semibold text-slate-700">
              {daily.length} days available
            </p>
            <DailyChart data={daily} metric={metric} />
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">
            {selectedAccount && !selectedAccount.is_smart_meter
              ? "myTNB identifies this as a Standard Meter. This dashboard currently fetches daily kWh through python-mytnb's smart-meter usage call, while standard-meter bill history contains no kWh. This chart cannot show measured usage for this account."
              : "No daily readings are stored yet. Sync this account to fetch available smart-meter history."}
          </div>
        )}
      </div>
    </div>
  );
}
