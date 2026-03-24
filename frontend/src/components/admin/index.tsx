import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Globe,
  Users,
  MessageSquare,
  ScrollText,
  ShoppingCart,
  LogOut,
  Lock,
  ChevronRight,
} from "lucide-react";
import { OverviewPage } from "./OverviewPage";
import { PagesPage } from "./PagesPage";
import { UsersPage } from "./UsersPage";
import { LeadsPage } from "./LeadsPage";
import { MessagesPage, LogsPage } from "./MessagesAndLogsPage";
import { API_BASE, TOKEN_KEY } from "@/lib/admin_api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "pages" | "users" | "messages" | "logs" | "leads";

const NAV: {
  id: Tab;
  label: string;
  icon: React.ElementType;
  badge?: string;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: Globe },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "leads", label: "Orders", icon: ShoppingCart },
];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  overview: "Stats across all your connected pages",
  pages: "Manage your connected Facebook pages",
  users: "All users who have messaged your pages",
  messages: "Full conversation history",
  logs: "Raw webhook event logs",
  leads: "Confirmed orders and sales pipeline",
};

// ── Login screen ──────────────────────────────────────────────────────────────

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
      if (!res.ok) throw new Error();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-card border rounded-3xl p-8 shadow-xl shadow-black/5 space-y-7">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3.5 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sign in to your admin panel
              </p>
            </div>
          </div>

          <Separator />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-10 rounded-xl"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-10 rounded-xl font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

function Dashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [leadStatusFilter, setLeadStatusFilter] = useState<
    string | undefined
  >();

  function navigateTo(t: string, extra?: string) {
    setTab(t as Tab);
    if (t === "leads" && extra) setLeadStatusFilter(extra);
    else setLeadStatusFilter(undefined);
  }

  function renderContent() {
    switch (tab) {
      case "overview":
        return <OverviewPage token={token} onNavigate={navigateTo} />;
      case "pages":
        return <PagesPage token={token} />;
      case "users":
        return <UsersPage token={token} />;
      case "messages":
        return <MessagesPage token={token} />;
      case "logs":
        return <LogsPage token={token} />;
      case "leads":
        return <LeadsPage token={token} initialStatus={leadStatusFilter} />;
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ── */}
      <aside className="w-60 border-r bg-card/50 backdrop-blur-sm flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Brand */}
        <div className="p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">Admin Panel</p>
              <p className="text-xs text-muted-foreground truncate">
                Messenger Bot
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
            Navigation
          </p>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => navigateTo(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                  transition-all duration-150 group
                  ${
                    active
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "" : "group-hover:text-foreground"}`}
                />
                <span className="truncate">{label}</span>
                {active && (
                  <ChevronRight className="h-3 w-3 ml-auto shrink-0 opacity-70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
              text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-8 py-4">
          <div className="max-w-6xl">
            <h1 className="text-lg font-semibold tracking-tight capitalize">
              {tab === "leads" ? "Orders" : tab}
            </h1>
            <p className="text-sm text-muted-foreground">
              {TAB_DESCRIPTIONS[tab]}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-w-6xl">{renderContent()}</div>
      </main>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  if (!token) return <LoginScreen onLogin={setToken} />;
  return (
    <Dashboard
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}
