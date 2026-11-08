"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccounts } from "@/hooks/useAccounts";
import { useMonthlyBills } from "@/hooks/useUsage";
import { BillsTable } from "@/components/dashboard/BillsTable";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { DataError } from "@/components/dashboard/DataError";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";

export default function BillsPage() {
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
    data: bills = [],
    isLoading,
    isError: billsFailed,
    error: billsError,
  } = useMonthlyBills(accountNumber);
  const selectedAccount = accounts.find(
    (account) => account.account_number === accountNumber,
  );
  const hasUnknownPaymentStatus = bills.some(
    (bill) => bill.payment_status === "unknown",
  );

  if (accountsLoading) return <PageSkeleton title="bills" cards={0} charts={1} />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bills</h1>
          <p className="text-sm text-slate-500">Monthly billing history</p>
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
      {billsFailed && (
        <DataError
          message={`Could not load bill history: ${billsError.message}`}
        />
      )}
      {selectedAccount && !selectedAccount.is_smart_meter && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {selectedAccount.is_tagged_smr === null
            ? selectedAccount.eligibility_checked_at
              ? "The account list currently says Standard Meter, and myTNB returned no SMR status for this account."
              : "The account list currently says Standard Meter, but the SMR status has not been checked."
            : "The myTNB SMR status check does not tag this account as a Smart Meter."}{" "}
          Standard-meter bill history may not include kWh usage.{" "}
          <Link
            href="/settings#accounts"
            className="font-medium underline"
          >
            Check meter status in Settings
          </Link>
          .
        </div>
      )}

      {/* Bar chart */}
      {bills.some((bill) => bill.usage_available) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">
            Monthly Usage (kWh) - last 12 months
          </p>
          <MonthlyChart
            data={bills.filter((bill) => bill.usage_available)}
            metric="usage_kwh"
          />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : billsFailed ? (
        <div className="py-12 text-center text-sm text-red-600">
          Bill history could not be loaded. See the error above.
        </div>
      ) : (
        <>
          {hasUnknownPaymentStatus && (
            <p className="text-xs text-slate-500">
              “Unknown” means myTNB did not provide a payment record that could
              be matched to that bill. It does not mean unpaid.
            </p>
          )}
          <BillsTable data={bills} />
        </>
      )}
    </div>
  );
}
