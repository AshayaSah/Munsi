import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { LEAD_STATUS_STYLES } from "@/lib/admin_api";

// ── Row skeleton ──────────────────────────────────────────────────────────────

export function RowSkeleton({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full rounded" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  loading,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  loading: boolean;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
      <span className="tabular-nums">
        Page <strong>{page}</strong> of <strong>{totalPages}</strong> &middot;{" "}
        <strong>{total.toLocaleString()}</strong> total
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(page - 1)}
          disabled={page === 1 || loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages || loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = "blue",
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?:
    | "blue"
    | "violet"
    | "emerald"
    | "amber"
    | "rose"
    | "orange"
    | "cyan"
    | "pink";
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    orange:
      "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
  };

  return (
    <div
      className={`rounded-2xl border bg-card p-5 space-y-4 transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground font-medium leading-tight">
          {label}
        </span>
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend && (
          <div
            className={`flex items-center gap-1 mt-2 text-xs font-medium
            ${trend.value >= 0 ? "text-emerald-600" : "text-rose-500"}`}
          >
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Lead status badge ─────────────────────────────────────────────────────────

export function LeadBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`text-xs border capitalize font-medium ${LEAD_STATUS_STYLES[status] ?? ""}`}
    >
      {status}
    </Badge>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────

export function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}
