import { useEffect, useState } from "react";
import {
  Globe,
  Users,
  MessageSquare,
  ScrollText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Package,
  Activity,
  Clock,
  UserX,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type Stats,
  type PageRow,
  type PageStats,
  type PaginatedResponse,
} from "@/lib/admin_api";
import { StatCard, SectionHeader } from "./shared";
import { Badge } from "@/components/ui/badge";

interface Props {
  token: string;
  onNavigate: (tab: string, pageId?: string) => void;
}

export function OverviewPage({ token, onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageStats, setPageStats] = useState<Record<string, PageStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Stats>("/stats", token),
      api<PaginatedResponse<PageRow>>("/pages?page_size=10", token),
    ])
      .then(([s, p]) => {
        setStats(s);
        setPages(p.items);
        // Fetch per-page stats in parallel
        Promise.all(
          p.items.map((pg) =>
            api<PageStats>(`/stats/page/${pg.id}`, token).then(
              (ps) => [pg.id, ps] as const,
            ),
          ),
        ).then((results) => {
          setPageStats(Object.fromEntries(results));
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <OverviewSkeleton />;
  if (!stats) return null;

  return (
    <div className="space-y-10">
      {/* KPI grid */}
      <div>
        <SectionHeader
          title="At a glance"
          description="Live counts across all connected pages"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Pages"
            value={stats.total_pages}
            sub={`${stats.active_pages} active`}
            icon={Globe}
            color="blue"
            onClick={() => onNavigate("pages")}
          />
          <StatCard
            label="Total Users"
            value={stats.total_users}
            sub={`${stats.active_users_24h} active today`}
            icon={Users}
            color="violet"
            onClick={() => onNavigate("users")}
          />
          <StatCard
            label="Messages"
            value={stats.total_messages}
            sub={`${stats.messages_today} today`}
            icon={MessageSquare}
            color="emerald"
            onClick={() => onNavigate("messages")}
          />
          <StatCard
            label="Unprocessed Logs"
            value={stats.unprocessed_logs}
            sub={`${stats.total_logs} total`}
            icon={ScrollText}
            color="amber"
            onClick={() => onNavigate("logs")}
          />
        </div>
      </div>

      {/* Lead funnel */}
      <div>
        <SectionHeader
          title="Order funnel"
          description="Sales lead pipeline overview"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Leads"
            value={stats.total_leads}
            icon={TrendingUp}
            color="cyan"
            onClick={() => onNavigate("leads")}
          />
          <StatCard
            label="Pending"
            value={stats.pending_leads}
            icon={AlertCircle}
            color="orange"
            onClick={() => onNavigate("leads", "pending")}
          />
          <StatCard
            label="Confirmed"
            value={stats.confirmed_leads}
            icon={CheckCircle2}
            color="emerald"
            onClick={() => onNavigate("leads", "confirmed")}
          />
          <StatCard
            label="Delivered"
            value={stats.delivered_leads}
            icon={Package}
            color="violet"
            onClick={() => onNavigate("leads", "delivered")}
          />
          <StatCard
            label="Cancelled"
            value={stats.cancelled_leads}
            icon={XCircle}
            color="rose"
            onClick={() => onNavigate("leads", "cancelled")}
          />
        </div>

        {/* Mini funnel bar */}
        {stats.total_leads > 0 && (
          <div className="mt-4 rounded-2xl border bg-card p-5">
            <p className="text-sm font-medium mb-3">Conversion flow</p>
            <div className="flex items-center gap-1 h-3">
              {[
                {
                  label: "Pending",
                  val: stats.pending_leads,
                  color: "bg-orange-400",
                },
                {
                  label: "Confirmed",
                  val: stats.confirmed_leads,
                  color: "bg-emerald-500",
                },
                {
                  label: "Delivered",
                  val: stats.delivered_leads,
                  color: "bg-violet-500",
                },
                {
                  label: "Cancelled",
                  val: stats.cancelled_leads,
                  color: "bg-rose-400",
                },
              ].map(({ label, val, color }) => {
                const pct = Math.round((val / stats.total_leads) * 100);
                if (pct === 0) return null;
                return (
                  <div
                    key={label}
                    title={`${label}: ${val} (${pct}%)`}
                    className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 flex-wrap">
              {[
                { label: "Pending", color: "bg-orange-400" },
                { label: "Confirmed", color: "bg-emerald-500" },
                { label: "Delivered", color: "bg-violet-500" },
                { label: "Cancelled", color: "bg-rose-400" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-page breakdown */}
      {pages.length > 0 && (
        <div>
          <SectionHeader
            title="Pages breakdown"
            description="Stats per connected Facebook page"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pages.map((pg) => {
              const ps = pageStats[pg.id];
              return (
                <div
                  key={pg.id}
                  className="rounded-2xl border bg-card p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => onNavigate("pages")}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-sm">{pg.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {pg.id}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        pg.is_active
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-red-100 text-red-500 border-red-200"
                      }
                    >
                      {pg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {ps ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Users", value: ps.total_users, icon: Users },
                        {
                          label: "Active 24h",
                          value: ps.active_users_24h,
                          icon: Activity,
                        },
                        {
                          label: "Messages",
                          value: ps.total_messages,
                          icon: MessageSquare,
                        },
                        {
                          label: "Confirmed",
                          value: ps.confirmed_leads,
                          icon: CheckCircle2,
                        },
                        {
                          label: "Pending",
                          value: ps.pending_leads,
                          icon: Clock,
                        },
                        {
                          label: "Blocked",
                          value: ps.blocked_users,
                          icon: UserX,
                        },
                      ].map(({ label, value, icon: Icon }) => (
                        <div
                          key={label}
                          className="text-center p-2 rounded-xl bg-muted/50"
                        >
                          <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-base font-bold tabular-nums">
                            {value}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-10">
      <div>
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-4 w-56 mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-32 mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
