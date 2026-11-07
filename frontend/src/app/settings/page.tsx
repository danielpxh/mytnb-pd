"use client";

import { useState } from "react";
import {
  useAccounts,
  useCheckEligibility,
  useSetNickname,
  useSyncAccount,
  useDiscoverAccounts,
} from "@/hooks/useAccounts";
import { useAuth } from "@/components/auth/AuthGate";
import { useTheme } from "@/app/providers";
import {
  Check,
  Moon,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SettingsPage() {
  const {
    email,
    sessionDurationHours,
    setSessionDurationHours,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: accounts = [] } = useAccounts();
  const profileName =
    accounts.find((account) => account.owner_name.trim())?.owner_name.trim() ??
    "";
  const setNickname = useSetNickname();
  const sync = useSyncAccount();
  const discover = useDiscoverAccounts();
  const checkEligibility = useCheckEligibility();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingSessionDuration, setSavingSessionDuration] = useState(false);

  async function changeSessionDuration(hours: number) {
    setSavingSessionDuration(true);
    try {
      await setSessionDurationHours(hours);
      toast.success(`Automatic sign-out set to ${hours} hour${hours === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update session duration.");
    } finally {
      setSavingSessionDuration(false);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage accounts and data sync</p>
      </div>

      <section
        id="profile"
        className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">My Profile</h2>
            <p className="text-sm text-slate-500">Details from your myTNB account</p>
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Account name
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">
              {profileName || "Discover accounts to load your name"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Sign-in email
            </dt>
            <dd className="mt-1 break-all text-sm text-slate-600">{email}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Appearance</h2>
          <p className="text-sm text-slate-500">
            Your theme choice is saved on this device and restored on your next visit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark"] as const).map((option) => {
            const Icon = option === "light" ? Sun : Moon;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  theme === option
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {option === "light" ? "Light" : "Dark"}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-slate-800">Automatic sign-out</h2>
          <p className="text-sm text-slate-500">
            Choose how long your sign-in remains active. Your myTNB credentials stay in backend memory until this time.
          </p>
        </div>
        <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium text-slate-700">
          Sign out after
          <select
            value={sessionDurationHours}
            disabled={savingSessionDuration}
            onChange={(event) => void changeSessionDuration(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {[1, 6, 12, 24].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hour{hours === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Discover */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Account Discovery</h2>
        <p className="text-sm text-slate-500">
          Scan your myTNB profile for linked electricity accounts.
        </p>
        <button
          onClick={() => discover.mutate()}
          disabled={discover.isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          <Search className="h-4 w-4" />
          {discover.isPending ? "Discovering…" : "Discover Accounts"}
        </button>
      </section>

      {/* Account list */}
      {accounts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Your Accounts</h2>
          <div className="space-y-3">
            {accounts.map((a) => (
              <div
                key={a.account_number}
                className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  {editing === a.account_number ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="rounded border border-brand-300 px-2 py-0.5 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-800">
                      {a.nickname || a.account_number}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {a.account_number} ·{" "}
                    {a.is_smart_meter ? (
                      <span className="text-green-600">Smart Meter</span>
                    ) : (
                      "Standard Meter"
                    )}
                  </p>
                  {a.last_synced && (
                    <p className="text-xs text-slate-400">
                      Last synced: {new Date(a.last_synced).toLocaleString()}
                    </p>
                  )}
                  {a.eligibility_checked_at && (
                    <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-700">
                        Eligibility indicators
                      </p>
                      <p>
                        Smart Meter Reading: {a.smr_eligibility ?? "No status returned"}
                        {a.is_tagged_smr !== null &&
                          ` · ${a.is_tagged_smr ? "Tagged" : "Not tagged"}`}
                      </p>
                      <p>
                        Bill rendering - owner override:{" "}
                        {a.bill_owner_over_rule === null
                          ? "No status returned"
                          : a.bill_owner_over_rule ? "Yes" : "No"}
                      </p>
                      <p>
                        Owner already opted in:{" "}
                        {a.bill_owner_already_opt_in === null
                          ? "No status returned"
                          : a.bill_owner_already_opt_in ? "Yes" : "No"}
                      </p>
                      <p>
                        Tenant already opted in:{" "}
                        {a.bill_tenant_already_opt_in === null
                          ? "No status returned"
                          : a.bill_tenant_already_opt_in ? "Yes" : "No"}
                      </p>
                      <p className="text-slate-400">
                        Checked {new Date(a.eligibility_checked_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[60%]">
                  {editing === a.account_number ? (
                    <button
                      onClick={() => {
                        setNickname.mutate({ accountNumber: a.account_number, nickname: draft });
                        setEditing(null);
                      }}
                      className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditing(a.account_number); setDraft(a.nickname); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => checkEligibility.mutate(a.account_number)}
                    disabled={checkEligibility.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {checkEligibility.isPending ? "Checking…" : "Check eligibility"}
                  </button>
                  <button
                    onClick={() => sync.mutate(a.account_number)}
                    disabled={sync.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={cn("h-3 w-3", sync.isPending && "animate-spin")} />
                    Sync
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            These myTNB account indicators are informational and do not guarantee eligibility for a service.
          </p>
        </section>
      )}

      {/* Info */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-800 mb-1">Geo-restriction Note</h2>
        <p className="text-sm text-amber-700">
          The myTNB API only accepts connections from Malaysian IP addresses.
          This app must run on your local machine or a VPS located in Malaysia.
        </p>
      </section>
    </div>
  );
}
