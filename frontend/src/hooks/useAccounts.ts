import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAccounts,
  discoverAccounts,
  syncAccount,
  checkAccountEligibility,
  setNickname,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: getAccounts,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useDiscoverAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: discoverAccounts,
    onSuccess: (data) => {
      toast.success(`Found ${data.discovered.length} account(s)`);
      void qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSyncAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountNumber: string) => syncAccount(accountNumber),
    onSuccess: async (_, accountNumber) => {
      toast.success(`Synced ${accountNumber}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
        qc.invalidateQueries({ queryKey: queryKeys.usage.all }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCheckEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkAccountEligibility,
    onSuccess: async (account) => {
      toast.success(`Eligibility indicators refreshed for ${account.account_number}`);
      await qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountNumber, nickname }: { accountNumber: string; nickname: string }) =>
      setNickname(accountNumber, nickname),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
