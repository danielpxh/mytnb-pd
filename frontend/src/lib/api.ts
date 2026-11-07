import type { Account, DailyUsage, MonthlyBill, UsageSummary } from "@/types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function poster<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Authentication ──────────────────────────────────────────────────────────

export interface AuthSession {
  authenticated: boolean;
  email?: string;
  duration_hours?: number;
  expires_at?: string;
}

export const getAuthSession = () => request<AuthSession>("/auth/session");

export const login = (
  email: string,
  password: string,
  duration_hours = 12,
) =>
  poster<{ email: string; duration_hours: number; expires_at: string }>(
    "/auth/login",
    { email, password, duration_hours },
  );

export const updateSessionDuration = (duration_hours: number) =>
  request<{ duration_hours: number; expires_at: string }>(
    "/auth/session/duration",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration_hours }),
    },
  );

export const logout = () => poster<{ ok: boolean }>("/auth/logout");

// ── Accounts ─────────────────────────────────────────────────────────────────

export const getAccounts = () => request<Account[]>("/accounts");

export const discoverAccounts = () =>
  poster<{ discovered: string[] }>("/accounts/discover");

export const syncAccount = (accountNumber: string) =>
  poster<{ status: string }>(`/accounts/${accountNumber}/sync`);

export const checkAccountEligibility = (accountNumber: string) =>
  poster<Account>(`/accounts/${accountNumber}/eligibility`);

export const setNickname = (accountNumber: string, nickname: string) =>
  request<{ ok: boolean }>(`/accounts/${accountNumber}/nickname`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });

// ── Usage ─────────────────────────────────────────────────────────────────────

export const getDailyUsage = (
  accountNumber: string,
  params?: { start?: string; end?: string },
) => {
  const qs = new URLSearchParams();
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  const q = qs.toString();
  return request<DailyUsage[]>(
    `/usage/daily/${accountNumber}${q ? `?${q}` : ""}`,
  );
};

export const getMonthlyBills = (accountNumber: string) =>
  request<MonthlyBill[]>(`/usage/monthly/${accountNumber}`);

export const getUsageSummary = (accountNumber: string) =>
  request<UsageSummary>(`/usage/summary/${accountNumber}`);
