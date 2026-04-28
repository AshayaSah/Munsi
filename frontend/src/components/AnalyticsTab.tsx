import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessageSquare,
  Users,
  UserPlus,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Globe,
  Activity,
  Layers,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacebookPage {
  id: string;
  name: string;
}

interface OverviewData {
  range_start: string;
  range_end: string;
  total_messages: number;
  user_messages: number;
  ai_messages: number;
  unique_users: number;
  new_users: number;
  failed_replies: number;
  reply_failure_rate: number;
  total_leads: number;
  confirmed_leads: number;
  conversion_rate: number;
}

interface HourlyBucket {
  day_of_week: number;
  hour: number;
  count: number;
}

interface HeatmapData {
  buckets: HourlyBucket[];
}

interface TimeseriesPoint {
  date: string;
  user_messages: number;
  ai_messages: number;
  total: number;
}

interface TimeseriesData {
  points: TimeseriesPoint[];
}

interface TopUser {
  user_id: number;
  fb_user_id: string;
  page_id: string;
  message_count: number;
  last_seen: string | null;
}

interface TopUsersData {
  users: TopUser[];
}

interface StatusCount {
  status: string;
  count: number;
}

interface LeadFunnelData {
  statuses: StatusCount[];
  total: number;
}

interface PageActivity {
  page_id: string;
  page_name: string;
  is_active: boolean;
  message_count: number;
  unique_users: number;
  confirmed_leads: number;
}

interface PagesActivityData {
  pages: PageActivity[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
);

const FUNNEL_COLORS: Record<string, string> = {
  interested: "#3b82f6",
  collecting: "#eab308",
  pending: "#f97316",
  confirmed: "#22c55e",
  cancelled: "#ef4444",
};

const FUNNEL_LABELS: Record<string, string> = {
  interested: "Interested",
  collecting: "Collecting",
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span
          className="p-1.5 rounded-lg"
          style={{ background: accent ? `${accent}18` : undefined }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: accent ?? "currentColor" }}
          />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </span>
      )}
      {sub && (
        <span className="text-xs text-muted-foreground -mt-1">{sub}</span>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Heatmap({
  data,
  loading,
}: {
  data: HeatmapData | null;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-44 w-full" />;
  }

  const grid: Record<string, number> = {};
  let maxCount = 0;
  data?.buckets.forEach(({ day_of_week, hour, count }) => {
    const key = `${day_of_week}-${hour}`;
    grid[key] = count;
    if (count > maxCount) maxCount = count;
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 ml-10">
          {HOUR_LABELS.map((h, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-muted-foreground"
              style={{ minWidth: 14 }}
            >
              {i % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {/* Grid */}
        {DAY_LABELS.map((day, d) => (
          <div key={d} className="flex items-center gap-0 mb-0.5">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0 text-right pr-2">
              {day}
            </span>
            {HOUR_LABELS.map((_, h) => {
              const count = grid[`${d}-${h}`] ?? 0;
              const intensity = maxCount > 0 ? count / maxCount : 0;
              const bg =
                intensity === 0
                  ? "hsl(var(--muted))"
                  : `hsl(221, 83%, ${Math.round(95 - intensity * 50)}%)`;
              return (
                <TooltipProvider key={h}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="flex-1 rounded-sm cursor-default"
                        style={{
                          minWidth: 14,
                          height: 14,
                          background: bg,
                          margin: "0 1px",
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {day} {HOUR_LABELS[h]}: {count} messages
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadFunnel({
  data,
  loading,
}: {
  data: LeadFunnelData | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-52 w-full" />;
  if (!data) return null;

  const max = Math.max(...data.statuses.map((s) => s.count), 1);

  return (
    <div className="space-y-3">
      {data.statuses.map(({ status, count }) => {
        const pct = max > 0 ? (count / max) * 100 : 0;
        const convPct =
          data.total > 0 ? ((count / data.total) * 100).toFixed(1) : "0";
        return (
          <div key={status} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-medium"
                style={{ color: FUNNEL_COLORS[status] }}
              >
                {FUNNEL_LABELS[status]}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {count}{" "}
                <span className="text-muted-foreground/60">({convPct}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: FUNNEL_COLORS[status],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const { user } = useAuth();

  // Page selector
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(
    undefined,
  );
  const [days, setDays] = useState("30");

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [topUsers, setTopUsers] = useState<TopUsersData | null>(null);
  const [funnel, setFunnel] = useState<LeadFunnelData | null>(null);
  const [pagesActivity, setPagesActivity] = useState<PagesActivityData | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch pages on mount
  useEffect(() => {
    const fetchPages = async () => {
      const accessToken = user?.accessToken;
      if (!accessToken) {
        setLoadingPages(false);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE}/api/user/pages?access_token=${accessToken}`,
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const fetched: FacebookPage[] = data.pages || [];
        setPages(fetched);
        if (fetched.length > 0) setSelectedPageId(fetched[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPages(false);
      }
    };
    fetchPages();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days });
    if (selectedPageId) params.set("page_id", selectedPageId);

    try {
      const [ovRes, hmRes, tsRes, tuRes, lfRes, paRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/overview?${params}`),
        fetch(`${API_BASE}/api/analytics/heatmap?${params}`),
        fetch(`${API_BASE}/api/analytics/timeseries?${params}`),
        fetch(`${API_BASE}/api/analytics/top-users?${params}&limit=10`),
        fetch(`${API_BASE}/api/analytics/lead-funnel?${params}`),
        fetch(
          `${API_BASE}/api/analytics/pages-activity?${new URLSearchParams({ days })}`,
        ),
      ]);

      const [ov, hm, ts, tu, lf, pa] = await Promise.all([
        ovRes.json(),
        hmRes.json(),
        tsRes.json(),
        tuRes.json(),
        lfRes.json(),
        paRes.json(),
      ]);

      setOverview(ov);
      setHeatmap(hm);
      setTimeseries(ts);
      setTopUsers(tu);
      setFunnel(lf);
      setPagesActivity(pa);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedPageId, days, refreshKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const chartData =
    timeseries?.points.map((p) => ({
      ...p,
      date: formatDate(p.date),
    })) ?? [];

  const funnelBarData =
    funnel?.statuses.map((s) => ({
      name: FUNNEL_LABELS[s.status],
      value: s.count,
      color: FUNNEL_COLORS[s.status],
    })) ?? [];

  return (
    <div className="space-y-6 p-1 overflow-auto">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page selector */}
          <Select
            value={selectedPageId ?? ""}
            onValueChange={setSelectedPageId}
            disabled={loadingPages || pages.length === 0}
          >
            <SelectTrigger className="w-52 h-9">
              {loadingPages ? (
                <span className="text-muted-foreground text-sm">
                  Loading pages…
                </span>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="All pages" />
                </div>
              )}
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={MessageSquare}
          label="Total Messages"
          value={overview ? fmt(overview.total_messages) : "—"}
          sub={
            overview
              ? `${fmt(overview.user_messages)} user · ${fmt(overview.ai_messages)} AI`
              : undefined
          }
          accent="#3b82f6"
          loading={loading && !overview}
        />
        <KpiCard
          icon={Users}
          label="Unique Users"
          value={overview ? fmt(overview.unique_users) : "—"}
          accent="#8b5cf6"
          loading={loading && !overview}
        />
        <KpiCard
          icon={UserPlus}
          label="New Users"
          value={overview ? fmt(overview.new_users) : "—"}
          accent="#06b6d4"
          loading={loading && !overview}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Total Leads"
          value={overview ? fmt(overview.total_leads) : "—"}
          sub={
            overview ? `${fmt(overview.confirmed_leads)} confirmed` : undefined
          }
          accent="#f97316"
          loading={loading && !overview}
        />
        <KpiCard
          icon={TrendingUp}
          label="Conversion"
          value={overview ? `${overview.conversion_rate}%` : "—"}
          sub={
            overview
              ? `${overview.reply_failure_rate}% failure rate`
              : undefined
          }
          accent="#22c55e"
          loading={loading && !overview}
        />
      </div>

      {/* ── Timeseries Chart ── */}
      <div className="rounded-xl border bg-card p-5">
        <SectionHeader title="Message Volume" icon={Activity} />
        {loading && !timeseries ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="gradUser" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="user_messages"
                name="User"
                stroke="#3b82f6"
                fill="url(#gradUser)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="ai_messages"
                name="AI"
                stroke="#8b5cf6"
                fill="url(#gradAi)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />{" "}
            User messages
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />{" "}
            AI messages
          </div>
        </div>
      </div>

      {/* ── Lead Funnel + Heatmap ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Lead Funnel bar chart */}
        <div className="rounded-xl border bg-card p-5">
          <SectionHeader title="Lead Funnel" icon={Layers} />
          {loading && !funnel ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={funnelBarData}
                  margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {funnelBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t">
                <LeadFunnel data={funnel} loading={false} />
              </div>
            </>
          )}
        </div>

        {/* Activity heatmap */}
        <div className="rounded-xl border bg-card p-5">
          <SectionHeader title="Message Activity Heatmap" icon={Activity} />
          <Heatmap data={heatmap} loading={loading && !heatmap} />
          <p className="text-xs text-muted-foreground mt-3">
            User messages by day & hour (darker = more activity)
          </p>
        </div>
      </div>

      {/* ── Top Users + Pages Activity ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Users */}
        <div className="rounded-xl border bg-card p-5">
          <SectionHeader title="Top Users" icon={Users} />
          {loading && !topUsers ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">FB User ID</TableHead>
                    <TableHead className="text-xs text-right">
                      Messages
                    </TableHead>
                    <TableHead className="text-xs">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers?.users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-20 text-center text-muted-foreground text-sm"
                      >
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    topUsers?.users.map((u, i) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground tabular-nums w-4">
                              {i + 1}
                            </span>
                            <span className="truncate max-w-[120px]">
                              {u.fb_user_id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">
                          {fmt(u.message_count)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_seen ? formatDate(u.last_seen) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pages Activity */}
        <div className="rounded-xl border bg-card p-5">
          <SectionHeader title="Pages Activity" icon={Globe} />
          {loading && !pagesActivity ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Page</TableHead>
                    <TableHead className="text-xs text-right">Msgs</TableHead>
                    <TableHead className="text-xs text-right">Users</TableHead>
                    <TableHead className="text-xs text-right">Leads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagesActivity?.pages.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-muted-foreground text-sm"
                      >
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagesActivity?.pages.map((p) => (
                      <TableRow key={p.page_id}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[130px] font-medium">
                              {p.page_name}
                            </span>
                            {p.is_active ? (
                              <Badge className="text-[10px] h-4 px-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100 border">
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1"
                              >
                                Off
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {fmt(p.message_count)}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {fmt(p.unique_users)}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-green-600 font-medium">
                          {p.confirmed_leads}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── Failure Rate Alert ── */}
      {overview && overview.reply_failure_rate > 5 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-destructive">
              High failure rate detected:
            </span>{" "}
            <span className="text-muted-foreground">
              {overview.reply_failure_rate}% of AI replies failed in the
              selected period ({overview.failed_replies} total).
            </span>
          </div>
        </div>
      )}

      {overview &&
        overview.reply_failure_rate <= 5 &&
        overview.confirmed_leads > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-green-700 dark:text-green-400">
                Healthy performance:
              </span>{" "}
              <span className="text-muted-foreground">
                {overview.conversion_rate}% conversion rate with only{" "}
                {overview.reply_failure_rate}% failure rate.
              </span>
            </div>
          </div>
        )}
    </div>
  );
}
