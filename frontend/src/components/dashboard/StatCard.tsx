import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && (
          <span className="text-slate-400">{icon}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {subtitle && (
          <span className="text-xs text-slate-500">{subtitle}</span>
        )}
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-energy-low" : "text-energy-high",
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
