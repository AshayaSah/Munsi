import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Send,
  MessageSquare,
  Users,
  Clock,
  Pause,
  Play,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  WebhookMessage,
  WebhookMessageItemProps,
} from "@/types/dashboard.types";

const API_BASE_URL = "http://localhost:8000";

// ─── Sub-components ───────────────────────────────────────────────────────────

const WebhookMessageItem: React.FC<WebhookMessageItemProps> = ({ message }) => (
  <div className="py-4 border-b last:border-0">
    <div className="flex items-center gap-3 mb-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {message.sender_id.substring(0, 2).toUpperCase()}
      </div>
      <p className="flex-1 truncate text-sm font-semibold">
        ID: {message.sender_id}
      </p>
      <span className="shrink-0 text-xs text-muted-foreground">
        {new Date(message.timestamp).toLocaleString()}
      </span>
    </div>
    {message.message_text && (
      <p className="ml-11 rounded-md border-l-2 border-primary bg-muted px-3 py-2 text-sm text-foreground">
        {message.message_text}
      </p>
    )}
    <div className="ml-11 mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>📧 {message.message_id || "N/A"}</span>
      {message.attachments?.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          📎 {message.attachments.length} attachment
          {message.attachments.length > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
}> = ({ icon, label, value }) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </CardContent>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const WebhookTab: React.FC = () => {
  const [webhookMessages, setWebhookMessages] = useState<WebhookMessage[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [lastUpdated, setLastUpdated] = useState<string>("Never");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [aimsg, setAimsg] = useState<string>("");
  const [aires, setAires] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ── Fetch webhook messages ─────────────────────────────────────────────
  const fetchWebhookMessages = useCallback(async (): Promise<void> => {
    try {
      const url = apiUrl.trim() || `${API_BASE_URL}/api/recent-messages`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setWebhookMessages(data.messages || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError("");
    } catch (err) {
      setError((err as Error).message || "Failed to fetch messages");
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchWebhookMessages();
  }, [fetchWebhookMessages]);

  useEffect(() => {
    if (!isAutoRefresh) return;
    const id = setInterval(fetchWebhookMessages, refreshInterval);
    return () => clearInterval(id);
  }, [isAutoRefresh, refreshInterval, fetchWebhookMessages]);

  // ── AI response ────────────────────────────────────────────────────────
  const getAiRes = async (): Promise<void> => {
    if (!aimsg.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/get_ai_res`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: aimsg }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setAires(data.reply as string);
      setAimsg("");
    } catch (err) {
      setError((err as Error).message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const uniqueSenders = new Set(webhookMessages.map((m) => m.sender_id)).size;
  const sortedWebhook = [...webhookMessages].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-5">
        {/* Error */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="flex items-center justify-between text-xs">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="ml-2 shrink-0 opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Total Messages"
            value={webhookMessages.length}
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

        {/* AI Agent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              AI Agent Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={aimsg}
                onChange={(e) => setAimsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && getAiRes()}
                placeholder="Send a message to the AI agent…"
                className="flex-1"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={getAiRes}
                disabled={loading || !aimsg.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {aires && (
              <div className="rounded-md border bg-muted p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Agent reply
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {aires}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchWebhookMessages}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAutoRefresh((p) => !p)}
              >
                {isAutoRefresh ? (
                  <>
                    <Pause className="mr-2 h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-3.5 w-3.5" />
                    Resume
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setWebhookMessages([])}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Clear
              </Button>

              <Select
                value={String(refreshInterval)}
                onValueChange={(v) => setRefreshInterval(Number(v))}
              >
                <SelectTrigger className="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">Every 2 seconds</SelectItem>
                  <SelectItem value="5000">Every 5 seconds</SelectItem>
                  <SelectItem value="10000">Every 10 seconds</SelectItem>
                  <SelectItem value="30000">Every 30 seconds</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Custom API URL (optional)"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="h-8 flex-1 min-w-[180px] text-xs"
              />

              {isAutoRefresh && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-green-300 bg-green-50 text-green-600"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  Live
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Recent Messages
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {webhookMessages.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-2">
            {sortedWebhook.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-6 w-6 opacity-40" />
                </div>
                <p className="text-sm">No messages received yet</p>
                <p className="text-xs text-muted-foreground/70">
                  Messages will appear here when users send them to your page
                </p>
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
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default WebhookTab;
