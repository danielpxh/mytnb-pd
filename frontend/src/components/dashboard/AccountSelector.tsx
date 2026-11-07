"use client";

import { RefreshCw, Search } from "lucide-react";
import type { Account } from "@/types";
import { useDiscoverAccounts, useSyncAccount } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";

interface Props {
  accounts: Account[];
  selected: string | undefined;
  onSelect: (accountNumber: string) => void;
}

export function AccountSelector({ accounts, selected, onSelect }: Props) {
  const discover = useDiscoverAccounts();
  const sync = useSyncAccount();

  return (
    <div className="flex items-center gap-3">
      {accounts.length > 0 ? (
        <div className="flex gap-2">
          {accounts.map((a) => (
            <button
              key={a.account_number}
              onClick={() => onSelect(a.account_number)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                selected === a.account_number
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {a.nickname || a.account_number}
              {a.is_smart_meter && (
                <span className="ml-1.5 text-xs text-green-600">●</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-sm text-slate-400">No accounts yet</span>
      )}

      <button
        onClick={() => selected && sync.mutate(selected)}
        disabled={!selected || sync.isPending}
        title="Sync selected account"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />
        Sync
      </button>

      <button
        onClick={() => discover.mutate()}
        disabled={discover.isPending}
        title="Discover accounts from myTNB"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        <Search className="h-3.5 w-3.5" />
        Discover
      </button>
    </div>
  );
}
