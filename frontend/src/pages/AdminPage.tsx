import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Globe,
  Users,
  MessageSquare,
  ScrollText,
  ShoppingCart,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "admin_token";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "pages" | "users" | "messages" | "logs" | "leads";

interface Stats {
  total_pages: number;
  active_pages: number;
  total_users: number;
  blocked_users: number;
  total_messages: number;
  total_logs: number;
  unprocessed_logs: number;
  total_leads: number;
  pending_leads: number;
  confirmed_leads: number;
}

interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

interface PageRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}
interface UserRow {
  id: number;
  user_id: string;
  page_id: string;
  last_seen: string | null;
  is_blocked: boolean;
  created_at: string;
}
interface MessageRow {
  id: number;
  page_id: string;
  user_id: number;
  from_role: string;
  content: string;
  sent_at: string;
  status: string;
}
interface LogRow {
  id: number;
  page_id: string | null;
  raw_message: string;
  is_processed: boolean;
  error: string | null;
  received_at: string;
}
interface LeadRow {
  id: number;
  page_id: string;
  user_id: number;
  status: string;
  confidence: number | null;
  customer_name: string | null;
  phone_number: string | null;
  product_interest: string | null;
  detected_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function Pagination({
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
    <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
      <span>
        Page {page} of {totalPages} · {total} total
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

// ── API helper ────────────────────────────────────────────────────────────────

async function api<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: any;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">
          {value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── LEAD STATUS CONFIG ────────────────────────────────────────────────────────

const LEAD_STATUS: Record<string, string> = {
  interested: "bg-blue-100 text-blue-700 border-blue-200",
  collecting: "bg-yellow-100 text-yellow-700 border-yellow-200",
  pending: "bg-orange-100 text-orange-700 border-orange-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-500 border-red-200",
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      onLogin(data.token);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 bg-card border rounded-2xl p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your bot
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────

function OverviewTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Stats>("/stats", token)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    );
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Pages & Users
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Pages"
            value={stats.total_pages}
            sub={`${stats.active_pages} active`}
            icon={Globe}
            accent="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Total Users"
            value={stats.total_users}
            sub={`${stats.blocked_users} blocked`}
            icon={Users}
            accent="bg-violet-100 text-violet-600"
          />
          <StatCard
            label="Messages"
            value={stats.total_messages}
            icon={MessageSquare}
            accent="bg-emerald-100 text-emerald-600"
          />
          <StatCard
            label="Logs"
            value={stats.total_logs}
            sub={`${stats.unprocessed_logs} unprocessed`}
            icon={ScrollText}
            accent="bg-amber-100 text-amber-600"
          />
        </div>
      </div>
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Sales Leads
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Total Leads"
            value={stats.total_leads}
            icon={TrendingUp}
            accent="bg-cyan-100 text-cyan-600"
          />
          <StatCard
            label="Pending"
            value={stats.pending_leads}
            icon={AlertCircle}
            accent="bg-orange-100 text-orange-600"
          />
          <StatCard
            label="Confirmed"
            value={stats.confirmed_leads}
            icon={CheckCircle2}
            accent="bg-green-100 text-green-600"
          />
        </div>
      </div>
    </div>
  );
}

// ── PAGES TAB ─────────────────────────────────────────────────────────────────

function PagesTab({ token }: { token: string }) {
  const [data, setData] = useState<PaginatedResponse<PageRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    api<PaginatedResponse<PageRow>>(`/pages?page=${page}&page_size=20`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function toggleActive(p: PageRow) {
    await api(`/pages/${p.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    fetch();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api(`/pages/${deleteId}`, token, { method: "DELETE" });
    setDeleteId(null);
    fetch();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? "…"} pages
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Page ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} cols={5} />
                ))
              : data?.items.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          p.is_active
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-red-100 text-red-500 border-red-200"
                        }
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmt(p.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleActive(p)}>
                            {p.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(p.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={setPage}
        loading={loading}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the page and all associated users,
              messages, and logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab({ token }: { token: string }) {
  const [data, setData] = useState<PaginatedResponse<UserRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    setLoading(true);
    api<PaginatedResponse<UserRow>>(`/users?page=${page}&page_size=20`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function toggleBlock(u: UserRow) {
    await api(`/users/${u.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_blocked: !u.is_blocked }),
    });
    fetch();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? "…"} users
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>FB PSID</TableHead>
              <TableHead>Page ID</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} cols={5} />
                ))
              : data?.items.map((u) => (
                  <TableRow key={u.id} className="group">
                    <TableCell className="font-mono text-xs">
                      {u.user_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.page_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_seen ? fmt(u.last_seen) : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          u.is_blocked
                            ? "bg-red-100 text-red-500 border-red-200"
                            : "bg-green-100 text-green-700 border-green-200"
                        }
                      >
                        {u.is_blocked ? "Blocked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleBlock(u)}>
                            {u.is_blocked ? "Unblock user" : "Block user"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={setPage}
        loading={loading}
      />
    </div>
  );
}

// ── MESSAGES TAB ──────────────────────────────────────────────────────────────

function MessagesTab({ token }: { token: string }) {
  const [data, setData] = useState<PaginatedResponse<MessageRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    setLoading(true);
    api<PaginatedResponse<MessageRow>>(
      `/messages?page=${page}&page_size=20`,
      token,
    )
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? "…"} messages
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} cols={5} />
                ))
              : data?.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {m.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          m.from_role === "user"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-violet-100 text-violet-700 border-violet-200"
                        }
                      >
                        {m.from_role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{m.content}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          m.status === "sent"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-red-100 text-red-500 border-red-200"
                        }
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(m.sent_at)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={setPage}
        loading={loading}
      />
    </div>
  );
}

// ── LOGS TAB ──────────────────────────────────────────────────────────────────

function LogsTab({ token }: { token: string }) {
  const [data, setData] = useState<PaginatedResponse<LogRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unprocessed">("all");

  const fetch = useCallback(() => {
    setLoading(true);
    const q = filter === "unprocessed" ? "&processed=false" : "";
    api<PaginatedResponse<LogRow>>(`/logs?page=${page}&page_size=20${q}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, filter, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "unprocessed"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {f === "all" ? "All" : "Unprocessed"}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Page ID</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} cols={5} />
                ))
              : data?.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {l.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.page_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      {l.is_processed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {l.error ? (
                        <p className="text-xs text-destructive truncate">
                          {l.error}
                        </p>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(l.received_at)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={setPage}
        loading={loading}
      />
    </div>
  );
}

// ── LEADS TAB ─────────────────────────────────────────────────────────────────

function LeadsTab({ token }: { token: string }) {
  const [data, setData] = useState<PaginatedResponse<LeadRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetch = useCallback(() => {
    setLoading(true);
    const q = statusFilter !== "all" ? `&status=${statusFilter}` : "";
    api<PaginatedResponse<LeadRow>>(
      `/leads?page=${page}&page_size=20${q}`,
      token,
    )
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, statusFilter, token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function updateStatus(id: number, status: string) {
    await api(`/leads/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    fetch();
  }

  const statuses = [
    "all",
    "interested",
    "collecting",
    "pending",
    "confirmed",
    "cancelled",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-8 capitalize"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetch}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <RowSkeleton key={i} cols={7} />
                ))
              : data?.items.map((l) => (
                  <TableRow key={l.id} className="group">
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {l.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {l.customer_name ?? (
                            <span className="text-muted-foreground italic font-normal">
                              Unknown
                            </span>
                          )}
                        </span>
                        {l.phone_number && (
                          <span className="text-xs text-muted-foreground">
                            {l.phone_number}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-40">
                      <p className="text-sm truncate">
                        {l.product_interest ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {l.confidence != null
                        ? `${Math.round(l.confidence * 100)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs border ${LEAD_STATUS[l.status] ?? ""}`}
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(l.updated_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {[
                            "interested",
                            "collecting",
                            "pending",
                            "confirmed",
                            "cancelled",
                          ]
                            .filter((s) => s !== l.status)
                            .map((s) => (
                              <DropdownMenuItem
                                key={s}
                                className="capitalize"
                                onClick={() => updateStatus(l.id, s)}
                              >
                                Mark as {s}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={setPage}
        loading={loading}
      />
    </div>
  );
}

// ── NAV ITEMS ─────────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: Globe },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "leads", label: "Leads", icon: ShoppingCart },
];

// ── DASHBOARD SHELL ───────────────────────────────────────────────────────────

function Dashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const content: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab token={token} />,
    pages: <PagesTab token={token} />,
    users: <UsersTab token={token} />,
    messages: <MessagesTab token={token} />,
    logs: <LogsTab token={token} />,
    leads: <LeadsTab token={token} />,
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 border-r bg-card flex flex-col shrink-0">
        <div className="p-5 border-b">
          <h1 className="font-semibold text-sm">Admin Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Messenger Bot</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${
                  tab === id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold capitalize">{tab}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tab === "overview" && "Stats across all your pages"}
              {tab === "pages" && "Manage your connected Facebook pages"}
              {tab === "users" && "All users who messaged your pages"}
              {tab === "messages" && "Full conversation history"}
              {tab === "logs" && "Raw webhook event logs"}
              {tab === "leads" && "Detected sales opportunities"}
            </p>
          </div>
          {content[tab]}
        </div>
      </main>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  function handleLogin(t: string) {
    setToken(t);
  }
  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
