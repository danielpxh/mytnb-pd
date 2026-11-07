"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useQueryClient } from "@tanstack/react-query";
import { getDailyUsage, getMonthlyBills, getUsageSummary } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthGate";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: Zap },
  { href: "/usage", label: "Usage", icon: BarChart2 },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const Icon = theme === "light" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={cn(
        "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50",
        iconOnly ? "h-10 w-10 px-0" : "w-full px-3",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!iconOnly && (
        <span className="whitespace-nowrap">
          {theme === "light" ? "Dark" : "Light"} mode
        </span>
      )}
    </button>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn("flex items-center", compact ? "justify-center" : "gap-3")}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-600/20">
        <Zap className="h-4 w-4 text-white" />
      </div>
      {!compact && (
        <div>
          <p className="font-semibold leading-tight text-slate-900">MyTNB-PD</p>
          <p className="text-[11px] leading-tight text-slate-500">
            Personal dashboard
          </p>
        </div>
      )}
    </div>
  );
}

function UserIdentity({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {(name || email).slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800" title={name}>
          {name || "myTNB profile"}
        </p>
        <p className="break-all text-xs text-slate-500" title={email}>
          {email}
        </p>
      </div>
    </div>
  );
}

function Navigation({
  mobile = false,
  collapsed = false,
}: {
  mobile?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function prefetchPage(href: string) {
    const accounts = queryClient.getQueryData<{ account_number: string }[]>(
      queryKeys.accounts.list(),
    );
    const accountNumber = accounts?.[0]?.account_number;
    if (!accountNumber) return;

    const options = { staleTime: 1000 * 60 * 10 };
    if (href === "/") {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.usage.summary(accountNumber),
          queryFn: () => getUsageSummary(accountNumber),
          ...options,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.usage.daily(accountNumber),
          queryFn: () => getDailyUsage(accountNumber),
          ...options,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.usage.monthly(accountNumber),
          queryFn: () => getMonthlyBills(accountNumber),
          ...options,
        }),
      ]);
    } else if (href === "/usage") {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.usage.daily(accountNumber),
        queryFn: () => getDailyUsage(accountNumber),
        ...options,
      });
    } else if (href === "/bills") {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.usage.monthly(accountNumber),
        queryFn: () => getMonthlyBills(accountNumber),
        ...options,
      });
    }
  }

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        mobile ? "grid grid-cols-4 gap-1" : "space-y-1",
      )}
    >
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onMouseEnter={() => prefetchPage(href)}
          onFocus={() => prefetchPage(href)}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              pathname !== href
            ) {
              setPendingHref(href);
            }
          }}
          aria-busy={pendingHref === href}
          aria-current={pathname === href ? "page" : undefined}
          aria-label={collapsed ? label : undefined}
          title={collapsed ? label : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium transition-colors",
            mobile
              ? "flex-col justify-center gap-1 px-2 py-2 text-xs"
              : collapsed
                ? "justify-center px-3 py-3"
                : "gap-3 px-3 py-2.5",
            pathname === href
              ? "bg-brand-50 text-brand-700"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {pendingHref === href ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
          {!collapsed && label}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { email, signOut } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const profileName =
    accounts.find((account) => account.owner_name.trim())?.owner_name.trim() ??
    "";

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
        className={cn(
          "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50",
          iconOnly ? "w-10 px-0" : "w-full",
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!iconOnly && <span>Sign out</span>}
      </button>
    );
  }

  return (
    <>
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 xl:flex",
          collapsed ? "w-[72px]" : "w-72",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-slate-200 py-5",
            collapsed ? "justify-center px-2" : "justify-between px-5",
          )}
        >
          <Brand compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className={cn("flex-1 py-5", collapsed ? "px-2" : "px-3")}>
          {!collapsed && (
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="mb-3 flex w-full justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <Navigation collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-slate-200 py-4",
            collapsed ? "px-2" : "px-3",
          )}
        >
          <Link
            href="/settings#profile"
            className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-brand-100 hover:bg-brand-50"
            aria-label={`View profile: ${profileName || "myTNB"}, ${email}`}
            title={collapsed ? `${profileName || "myTNB"} · ${email}` : undefined}
          >
            {collapsed ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                {(profileName || email).slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <>
                <UserIdentity email={email} name={profileName} />
                <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  Connected to myTNB
                </p>
              </>
            )}
          </Link>
          <div className={cn("grid gap-2", collapsed && "justify-items-center")}>
            <ThemeToggle iconOnly={collapsed} />
            <SignOutButton iconOnly={collapsed} />
          </div>
          {!collapsed && (
            <p className="px-1 text-[10px] leading-relaxed text-slate-400">
              © 2026 MyTNB-PD contributors. TNB and myTNB are trademarks of
              Tenaga Nasional Berhad. Unofficial and unaffiliated.
            </p>
          )}
        </div>
      </aside>

      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 xl:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Brand />
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
        <Link
          href="/settings#profile"
          className="my-3 block min-w-0 border-t border-slate-100 pt-3"
          aria-label={`View profile: ${profileName || "myTNB"}, ${email}`}
        >
          <UserIdentity email={email} name={profileName} />
          <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
            Connected to myTNB
          </p>
        </Link>
        {mobileOpen && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <ThemeToggle />
              <SignOutButton />
            </div>
            <Navigation mobile />
          </>
        )}
      </header>
    </>
  );
}
