import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  MessageSquare,
  Users,
  Clock,
  Pause,
  Play,
  Trash2,
  Activity,
  X,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { WebhookMessage } from "@/types/dashboard.types";
import WebhookMessageItem from "./WebhookMessageItem";

const API_BASE_URL = "http://localhost:8000";

// ─── Skeletons ────────────────────────────────────────────────────────────────

const StatSkeleton = () => (
  <div className="grid grid-cols-3 gap-2 shrink-0">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="shadow-none border-border/60">
        <CardContent className="flex items-center gap-2.5 p-3">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-2 w-16 rounded" />
            <Skeleton className="h-4 w-10 rounded" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const MessageSkeleton = () => (
  <div className="space-y-2 px-1">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="py-2 border-b last:border-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
          <Skeleton className="h-3 w-32 rounded flex-1" />
          <Skeleton className="h-2.5 w-20 rounded shrink-0" />
        </div>
        <Skeleton className="ml-8 h-8 w-full rounded-md" />
      </div>
    ))}
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}> = ({ icon, label, value, accent }) => (
  <Card
    className={cn(
      "shadow-none border-border/60 transition-colors",
      accent && "border-primary/30 bg-primary/5",
    )}
  >
    <CardContent className="flex items-center gap-2.5 p-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          accent
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium truncate">
          {label}
        </p>
        <p className="text-base font-bold leading-tight tabular-nums">
          {value}
        </p>
      </div>
    </CardContent>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const WebhookTab: React.FC = () => {
  const [webhookMessages, setWebhookMessages] = useState<WebhookMessage[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // ── Fetch webhook messages ─────────────────────────────────────────────
  const fetchWebhookMessages = useCallback(
    async (isInitial = false): Promise<void> => {
      try {
        const url = apiUrl.trim() || `${API_BASE_URL}/api/recent-messages`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setWebhookMessages(data.messages || []);
        setLastUpdated(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
        setError("");
      } catch (err) {
        setError((err as Error).message || "Failed to fetch messages");
      } finally {
        if (isInitial) setInitialLoading(false);
      }
    },
    [apiUrl],
  );

  // Auto-load on mount
  useEffect(() => {
    fetchWebhookMessages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAutoRefresh) return;
    const id = setInterval(() => fetchWebhookMessages(false), refreshInterval);
    return () => clearInterval(id);
  }, [isAutoRefresh, refreshInterval, fetchWebhookMessages]);

  const uniqueSenders = new Set(webhookMessages.map((m) => m.sender_id)).size;
  const sortedWebhook = [...webhookMessages].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    /*
      h-full + min-h-0 + overflow-hidden: stays locked inside the dashboard.
      Only the messages ScrollArea scrolls internally.
    */
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden">
      {/* Error */}
      {error && (
        <Alert variant="destructive" className="py-1.5 shrink-0">
          <AlertDescription className="flex items-center justify-between text-xs">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats row — always visible, never scrolls away */}
      {initialLoading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Total Messages"
            value={webhookMessages.length}
            accent={webhookMessages.length > 0}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Unique Senders"
            value={uniqueSenders}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Last Updated"
            value={lastUpdated}
          />
        </div>
      )}

      {/* Middle section: AI Agent + Controls side by side on wide screens, stacked on narrow */}
      <div className="grid grid-cols-1 shrink-0">
        {/* Controls card */}
        <Card className="shadow-none border-border/60 gap-0 py-0">
          <CardHeader className="px-3 pb-1.5 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted">
                  <Radio className="h-3 w-3 text-muted-foreground" />
                </div>
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Live Controls
                </CardTitle>
              </div>
              {isAutoRefresh && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => fetchWebhookMessages(false)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 h-8",
                  isAutoRefresh
                    ? "text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-900 dark:hover:bg-amber-950/30"
                    : "text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/30",
                )}
                onClick={() => setIsAutoRefresh((p) => !p)}
              >
                {isAutoRefresh ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setWebhookMessages([])}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>

              <Separator
                orientation="vertical"
                className="h-6 hidden sm:block"
              />

              <Select
                value={String(refreshInterval)}
                onValueChange={(v) => setRefreshInterval(Number(v))}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">Every 2s</SelectItem>
                  <SelectItem value="5000">Every 5s</SelectItem>
                  <SelectItem value="10000">Every 10s</SelectItem>
                  <SelectItem value="30000">Every 30s</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Custom API URL (optional)"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="h-8 flex-1 min-w-[160px] text-xs bg-background"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages card — flex-1 + min-h-0 fills remaining space, ScrollArea handles overflow */}
      <Card className="shadow-none border-border/60 flex-1 min-h-0 flex flex-col overflow-hidden gap-0 py-0">
        <CardHeader className="px-3 pb-1.5 pt-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
              </div>
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Recent Messages
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {webhookMessages.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {webhookMessages.length}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <Separator className="shrink-0" />

        {/* Only this ScrollArea scrolls */}
        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-3 py-2 flex flex-col justify-evenly gap-2">
              {initialLoading ? (
                <MessageSkeleton />
              ) : sortedWebhook.length === 0 ? (
                <div className="flex flex-col items-center gap-2.5 py-10 text-muted-foreground">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <MessageSquare className="h-5 w-5 opacity-30" />
                    {isAutoRefresh && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                        <span className="h-2 w-2 animate-ping rounded-full bg-white opacity-75" />
                      </span>
                    )}
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      No messages yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                      {isAutoRefresh
                        ? "Listening for incoming messages…"
                        : "Auto-refresh is paused. Click Resume to start listening."}
                    </p>
                  </div>
                </div>
              ) : (
                sortedWebhook.map((msg, i) => (
                  <WebhookMessageItem
                    key={`${msg.message_id}-${i}`}
                    message={msg}
                    index={i}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookTab;
