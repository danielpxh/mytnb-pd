import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMYR(value: number): string {
  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatKWh(value: number): string {
  return `${value.toFixed(2)} kWh`;
}

export function monthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), "MMM yyyy");
}

export function isoDateToLabel(iso: string): string {
  return format(parseISO(iso), "d MMM ''yy");
}
