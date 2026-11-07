export const queryKeys = {
  accounts: {
    all: ["accounts"] as const,
    list: () => [...queryKeys.accounts.all, "list"] as const,
  },
  usage: {
    all: ["usage"] as const,
    summary: (account: string) =>
      [...queryKeys.usage.all, "summary", account] as const,
    daily: (account: string, start?: string, end?: string) =>
      [...queryKeys.usage.all, "daily", account, start, end] as const,
    monthly: (account: string) =>
      [...queryKeys.usage.all, "monthly", account] as const,
  },
};
