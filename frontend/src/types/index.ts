export interface Account {
  account_number: string;
  owner_name: string;
  nickname: string;
  tariff_type: string;
  is_smart_meter: boolean;
  last_synced: string | null;
  smr_eligibility: string | null;
  is_tagged_smr: boolean | null;
  bill_owner_over_rule: boolean | null;
  bill_owner_already_opt_in: boolean | null;
  bill_tenant_already_opt_in: boolean | null;
  eligibility_checked_at: string | null;
}

export interface DailyUsage {
  date: string;
  usage_kwh: number;
  cost_myr: number;
}

export interface MonthlyBill {
  year: number;
  month: number;
  usage_kwh: number;
  usage_available: boolean;
  amount_myr: number;
  billing_no: string;
  due_date: string | null;
  is_paid: boolean;
  payment_status: "paid" | "unpaid" | "unknown" | "unbilled";
}

export interface UsageSummary {
  latest_bill: {
    year: number;
    month: number;
    usage_kwh: number;
    usage_available: boolean;
    amount_myr: number;
    is_paid: boolean;
    payment_status: "paid" | "unpaid" | "unknown" | "unbilled";
    due_date: string | null;
  } | null;
  last_30_days: {
    total_kwh: number;
    total_myr: number;
    days: number;
  };
  daily_available: boolean;
}

export type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};
