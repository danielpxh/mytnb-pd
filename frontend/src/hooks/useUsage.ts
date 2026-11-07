import { useQuery } from "@tanstack/react-query";
import { getDailyUsage, getMonthlyBills, getUsageSummary } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useUsageSummary(accountNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.usage.summary(accountNumber ?? ""),
    queryFn: () => getUsageSummary(accountNumber!),
    enabled: !!accountNumber,
    staleTime: 1000 * 60 * 10,
  });
}

export function useDailyUsage(
  accountNumber: string | undefined,
  params?: { start?: string; end?: string },
) {
  return useQuery({
    queryKey: queryKeys.usage.daily(accountNumber ?? "", params?.start, params?.end),
    queryFn: () => getDailyUsage(accountNumber!, params),
    enabled: !!accountNumber,
    staleTime: 1000 * 60 * 10,
  });
}

export function useMonthlyBills(accountNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.usage.monthly(accountNumber ?? ""),
    queryFn: () => getMonthlyBills(accountNumber!),
    enabled: !!accountNumber,
    staleTime: 1000 * 60 * 10,
  });
}
