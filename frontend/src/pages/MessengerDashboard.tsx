import React, { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  LogOut,
  RefreshCw,
  Send,
  User,
  Check,
  MessageSquare,
  Users,
  Clock,
  Pause,
  Play,
  Trash2,
  ChevronRight,
  Zap,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
  TabId,
  FacebookPage,
  Conversation,
  ConversationParticipant,
  FacebookMessage,
  WebhookMessage,
  PageListItemProps,
  ConversationListItemProps,
  BubbleProps,
  WebhookMessageItemProps,
} from "../types/dashboard.types";
import { useAuth } from "@/context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL = "http://localhost:8000";
const PAGE_NAME_FILTER = "Ethan Apparels";

// ─── Sub-components ───────────────────────────────────────────────────────────

const PageListItem: React.FC<PageListItemProps> = ({
  page,
  isSelected,
  onSelect,
}) => (
  <button
    className={cn(
      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
      isSelected
        ? "bg-primary text-primary-foreground"
        : "hover:bg-muted text-foreground",
    )}
    onClick={() => onSelect(page)}
  >
    <span className="truncate font-medium">{page.name}</span>
    <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
  </button>
);

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isSelected,
  onSelect,
}) => (
  <button
    className={cn(
      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors text-left",
      isSelected
        ? "bg-primary text-primary-foreground"
        : "hover:bg-muted text-foreground",
    )}
    onClick={() => onSelect(conversation.id, conversation.participants.data)}
  >
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">
        {conversation.snippet || "No preview"}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs",
          isSelected ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {conversation.message_count || 0} msgs ·{" "}
        {new Date(conversation.updated_time).toLocaleDateString()}
      </p>
    </div>
    <ChevronRight className="ml-2 h-3 w-3 shrink-0 opacity-50" />
  </button>
);

const Bubble: React.FC<BubbleProps> = ({ message, isFromPage }) => (
  <div className={cn("flex", isFromPage ? "justify-end" : "justify-start")}>
    <div className="max-w-[70%]">
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isFromPage
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.message || "(No text content)"}
      </div>
      <p
        className={cn(
          "mt-1 text-xs text-muted-foreground",
          isFromPage ? "text-right" : "text-left",
        )}
      >
        {message.from?.name} ·{" "}
        {new Date(message.created_time).toLocaleTimeString()}
      </p>
    </div>
  </div>
);

const WebhookMessageItem: React.FC<WebhookMessageItemProps> = ({ message }) => (
  <div className="py-4 border-b last:border-0">
    <div className="flex items-center gap-3 mb-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {message.sender_id.substring(0, 2).toUpperCase()}
      </div>
      <p className="flex-1 text-sm font-semibold">ID: {message.sender_id}</p>
      <span className="text-xs text-muted-foreground">
        {new Date(message.timestamp).toLocaleString()}
      </span>
    </div>
    {message.message_text && (
      <p className="ml-11 rounded-md border-l-2 border-primary bg-muted px-3 py-2 text-sm text-foreground">
        {message.message_text}
      </p>
    )}
    <div className="ml-11 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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

// ─── Main Component ───────────────────────────────────────────────────────────

const UnifiedDashboard: React.FC = () => {
  // ── Auth (from context) ─────────────────────────────────────────────────
  const { user, isLoggedIn, logout } = useAuth();
  const accessToken = user?.accessToken ?? "";
  const userName = user?.userId ?? "";

  // ── Navigation ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("messenger");

  // ── Messenger state ─────────────────────────────────────────────────────
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<FacebookMessage[]>([]);
  const [participant, setParticipant] = useState<string>("");
  const [participants, setParticipants] = useState<ConversationParticipant[]>(
    [],
  );
  const [outMessage, setOutMessage] = useState<string>("");
  const [messageCount, setMessageCount] = useState<number>(0);

  // ── Webhook state ───────────────────────────────────────────────────────
  const [webhookMessages, setWebhookMessages] = useState<WebhookMessage[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [lastUpdated, setLastUpdated] = useState<string>("Never");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [aimsg, setAimsg] = useState<string>("");
  const [aires, setAires] = useState<string>("");

  // ── Shared ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ─── Auth handlers ─────────────────────────────────────────────────────
  const handleLogout = (): void => {
    logout();
    setPages([]);
    setConversations([]);
    setMessages([]);
    setSelectedPage(null);
    setSelectedConversationId(null);
    setWebhookMessages([]);
  };

  // ─── Messenger: fetch pages ────────────────────────────────────────────
  const fetchPages = async (): Promise<void> => {
    if (!accessToken) {
      setError("Please provide an access token first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/user/pages?access_token=${accessToken}`,
      );
      if (!res.ok) throw new Error("Failed to fetch pages");
      const data = await res.json();
      const fetched: FacebookPage[] = data.pages || [];
      setPages(fetched);
      if (fetched.length > 0) setSelectedPage(fetched[0]);
      else setError("No Facebook Pages found.");
    } catch (err) {
      setError(`Error fetching pages: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Messenger: fetch conversations ───────────────────────────────────
  const fetchConversations = async (): Promise<void> => {
    if (!selectedPage) {
      setError("Please select a page first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/conversations?access_token=${selectedPage.access_token}&page_id=${selectedPage.id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data.data || []);
    } catch (err) {
      setError(`Error fetching conversations: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Messenger: fetch messages ─────────────────────────────────────────
  const fetchMessages = useCallback(
    async (
      conversationId: string | null,
      parts?: ConversationParticipant[],
    ): Promise<void> => {
      if (!conversationId || !selectedPage) return;
      setLoading(true);
      setError("");
      try {
        const currentParts = parts ?? participants;
        const p =
          currentParts.find((cp) => cp.name !== PAGE_NAME_FILTER)?.id ?? "";
        setParticipants(currentParts);
        setParticipant(p);
        const res = await fetch(
          `${API_BASE_URL}/api/messages?access_token=${accessToken}&page_id=${selectedPage.id}&conversation_id=${conversationId}`,
        );
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        setMessages(data.messages?.data || []);
        setSelectedConversationId(conversationId);
      } catch (err) {
        setError(`Error fetching messages: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, selectedPage, participants],
  );

  useEffect(() => {
    if (messageCount > 0) fetchMessages(selectedConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  // ─── Messenger: send message ───────────────────────────────────────────
  const sendMessage = async (): Promise<void> => {
    if (!outMessage.trim() || !selectedPage) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/send-message?access_token=${accessToken}&page_id=${selectedPage.id}&recipient_id=${participant}&message_text=${encodeURIComponent(outMessage)}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to send message");
      setMessageCount((c) => c + 1);
      setOutMessage("");
    } catch (err) {
      setError(`Error sending message: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Webhook: fetch recent messages ───────────────────────────────────
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

  // ─── AI: get response ──────────────────────────────────────────────────
  const getAiRes = async (): Promise<void> => {
    if (!aimsg.trim()) return;
    setLoading(true);
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
      setError("");
    } catch (err) {
      setError((err as Error).message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "webhook") fetchWebhookMessages();
  }, [activeTab, fetchWebhookMessages]);

  useEffect(() => {
    if (!isAutoRefresh || activeTab !== "webhook") return;
    const id = setInterval(fetchWebhookMessages, refreshInterval);
    return () => clearInterval(id);
  }, [isAutoRefresh, refreshInterval, activeTab, fetchWebhookMessages]);

  // ─── Derived ──────────────────────────────────────────────────────────
  const uniqueSenders = new Set(webhookMessages.map((m) => m.sender_id)).size;
  const sortedWebhook = [...webhookMessages].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  // ─── Main dashboard ────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-52 shrink-0 flex-col border-r bg-card">
          {/* Brand */}
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">AgentDesk</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-1 flex-col gap-1 p-2">
            {(["messenger", "webhook"] as TabId[]).map((tab) => (
              <button
                key={tab}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "messenger" ? (
                  <MessageCircle className="h-4 w-4" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {tab === "messenger" ? "Messenger" : "Webhook & AI"}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {userName || "User"}
              </p>
              {accessToken && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-2.5 w-2.5" /> Connected
                </p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Logout</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Error banner */}
          {error && (
            <Alert variant="destructive" className="m-4 mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setError("")}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── MESSENGER TAB ── */}
          {activeTab === "messenger" && (
            <div className="flex flex-1 overflow-hidden">
              {/* Left panel */}
              <div className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r p-3">
                {/* Pages */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                      Pages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 px-3 pb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={fetchPages}
                      disabled={loading || !accessToken}
                    >
                      <RefreshCw
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          loading && "animate-spin",
                        )}
                      />
                      {loading ? "Loading…" : "Load Pages"}
                    </Button>

                    {pages.map((page) => (
                      <PageListItem
                        key={page.id}
                        page={page}
                        isSelected={selectedPage?.id === page.id}
                        onSelect={setSelectedPage}
                      />
                    ))}

                    {selectedPage && (
                      <>
                        <Separator className="my-2" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={fetchConversations}
                          disabled={loading}
                        >
                          <MessageSquare className="mr-2 h-3.5 w-3.5" />
                          Load Conversations
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Conversations */}
                {conversations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                        Conversations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-3 pb-3">
                      {conversations.map((conv) => (
                        <ConversationListItem
                          key={conv.id}
                          conversation={conv}
                          isSelected={selectedConversationId === conv.id}
                          onSelect={fetchMessages}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Chat panel */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {messages.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between border-b px-5 py-3">
                      <p className="font-semibold text-sm">Conversation</p>
                      <Badge variant="secondary">
                        {messages.length} messages
                      </Badge>
                    </div>

                    <ScrollArea className="flex-1 px-5 py-4">
                      <div className="flex flex-col gap-3">
                        {[...messages].reverse().map((msg) => (
                          <Bubble
                            key={msg.id}
                            message={msg}
                            isFromPage={msg.from?.id === selectedPage?.id}
                          />
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2 border-t p-3">
                      <Input
                        value={outMessage}
                        onChange={(e) => setOutMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Type a message…"
                        className="flex-1"
                      />
                      <Button onClick={sendMessage} disabled={loading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 opacity-20" />
                    <p className="font-semibold text-foreground">
                      No conversation selected
                    </p>
                    <p className="text-sm">
                      Select a conversation from the sidebar
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── WEBHOOK TAB ── */}
          {activeTab === "webhook" && (
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4 p-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      icon: <MessageSquare className="h-4 w-4" />,
                      label: "Total Messages",
                      value: webhookMessages.length,
                    },
                    {
                      icon: <Users className="h-4 w-4" />,
                      label: "Unique Senders",
                      value: uniqueSenders,
                    },
                    {
                      icon: <Clock className="h-4 w-4" />,
                      label: "Last Updated",
                      value: lastUpdated,
                    },
                  ].map(({ icon, label, value }) => (
                    <Card key={label}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="text-muted-foreground">{icon}</div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-lg font-bold">{value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* AI Test */}
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
                      />
                      <Button onClick={getAiRes} disabled={loading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    {aires && (
                      <div className="rounded-md border bg-muted p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Agent reply
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{aires}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Controls */}
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
                        <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-3.5 w-3.5" /> Resume
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
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000">2 seconds</SelectItem>
                      <SelectItem value="5000">5 seconds</SelectItem>
                      <SelectItem value="10000">10 seconds</SelectItem>
                      <SelectItem value="30000">30 seconds</SelectItem>
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
                      className="gap-1.5 text-green-600 border-green-300 bg-green-50"
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      Live
                    </Badge>
                  )}
                </div>

                {/* Webhook messages */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                      Recent Messages ({webhookMessages.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    {sortedWebhook.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 opacity-20" />
                        <p className="text-sm">No messages received yet</p>
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
          )}
        </main>
      </div>
    </TooltipProvider>
  );
};

export default UnifiedDashboard;
