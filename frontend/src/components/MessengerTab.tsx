import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Send,
  MessageSquare,
  MessageCircle,
  ChevronRight,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

import type {
  FacebookPage,
  Conversation,
  ConversationParticipant,
  FacebookMessage,
  PageListItemProps,
  ConversationListItemProps,
  BubbleProps,
} from "@/types/dashboard.types";

const API_BASE_URL = "http://localhost:8000";
const PAGE_NAME_FILTER = "Ethan Apparels";

// ─── Skeleton Components ──────────────────────────────────────────────────────

const PagesSkeleton = () => (
  <div className="space-y-1.5">
    {[...Array(2)].map((_, i) => (
      <Skeleton key={i} className="h-8 w-full rounded-md" />
    ))}
  </div>
);

const ConversationsSkeleton = () => (
  <div className="space-y-1.5">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="rounded-md p-2 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-2.5 w-1/2 rounded" />
      </div>
    ))}
  </div>
);

const MessagesSkeleton = () => (
  <div className="flex flex-col gap-4 px-5 py-4">
    {[false, true, false, false, true, false, true].map((fromPage, i) => (
      <div
        key={i}
        className={cn("flex", fromPage ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[60%] space-y-1.5",
            fromPage && "items-end flex flex-col",
          )}
        >
          <Skeleton
            className={cn(
              "h-9 rounded-xl",
              i % 3 === 0 ? "w-48" : i % 3 === 1 ? "w-32" : "w-56",
            )}
          />
          <Skeleton className="h-2.5 w-20 rounded" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const PageListItem: React.FC<PageListItemProps> = ({
  page,
  isSelected,
  onSelect,
}) => (
  <button
    className={cn(
      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-all duration-150",
      isSelected
        ? "bg-primary text-primary-foreground shadow-sm"
        : "hover:bg-muted text-foreground",
    )}
    onClick={() => onSelect(page)}
  >
    <span className="truncate font-medium">{page.name}</span>
    <ChevronRight
      className={cn(
        "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
        isSelected ? "opacity-80 translate-x-0.5" : "opacity-40",
      )}
    />
  </button>
);

const ConversationListItem: React.FC<
  ConversationListItemProps & { isLoading?: boolean }
> = ({ conversation, isSelected, onSelect, isLoading }) => (
  <button
    disabled={isLoading}
    className={cn(
      "flex w-52 items-center justify-between rounded-md px-3 py-2 text-sm transition-all duration-150 text-left border",
      isSelected
        ? "bg-primary text-primary-foreground shadow-sm"
        : "hover:bg-muted text-foreground",
      isLoading && "opacity-60 cursor-not-allowed",
    )}
    onClick={() => onSelect(conversation.id, conversation.participants.data)}
  >
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium leading-tight">
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
    <ChevronRight
      className={cn(
        "ml-2 h-3.5 w-3.5 shrink-0 transition-transform duration-150",
        isSelected ? "opacity-80 translate-x-0.5" : "opacity-40",
      )}
    />
  </button>
);

const Bubble: React.FC<BubbleProps> = ({ message, isFromPage }) => (
  <div className={cn("flex", isFromPage ? "justify-end" : "justify-start")}>
    <div className="max-w-[72%]">
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
          isFromPage
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.message || "(No text content)"}
      </div>
      <p
        className={cn(
          "mt-1 text-[11px] text-muted-foreground",
          isFromPage ? "text-right" : "text-left",
        )}
      >
        {message.from?.name} ·{" "}
        {new Date(message.created_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MessengerTab: React.FC = () => {
  const { user } = useAuth();
  const accessToken = user?.accessToken ?? "";

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

  const [loadingPages, setLoadingPages] = useState<boolean>(false);
  const [loadingConversations, setLoadingConversations] =
    useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (accessToken) fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (selectedPage) fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage?.id]);

  const fetchPages = async (): Promise<void> => {
    if (!accessToken) {
      setError("No access token found.");
      return;
    }
    setLoadingPages(true);
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
      setLoadingPages(false);
    }
  };

  const fetchConversations = async (): Promise<void> => {
    if (!selectedPage) return;
    setLoadingConversations(true);
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
      setLoadingConversations(false);
    }
  };

  const fetchMessages = useCallback(
    async (
      conversationId: string | null,
      parts?: ConversationParticipant[],
    ): Promise<void> => {
      if (!conversationId || !selectedPage) return;
      setLoadingMessages(true);
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
        setLoadingMessages(false);
      }
    },
    [accessToken, selectedPage, participants],
  );

  useEffect(() => {
    if (messageCount > 0) fetchMessages(selectedConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  const sendMessage = async (): Promise<void> => {
    if (!outMessage.trim() || !selectedPage) return;
    setSendingMessage(true);
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
      setSendingMessage(false);
    }
  };

  return (
    /*
      h-full fills the parent container exactly.
      overflow-hidden stops this from growing the page.
    */
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div className="flex w-64 shrink-0 flex-col gap-2.5 border-r pr-3 min-h-0 overflow-hidden">
        {/* Error banner */}
        {error && (
          <Alert variant="destructive" className="py-2 shrink-0">
            <AlertDescription className="flex items-center justify-between text-xs">
              <span className="leading-snug">{error}</span>
              <button
                onClick={() => setError("")}
                className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Pages card — shrink-0 keeps it from being squished */}
        <Card className="border-border/60 shadow-none shrink-0 pt-1 gap-1">
          <CardHeader className="px-4 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pages
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={fetchPages}
                disabled={loadingPages || !accessToken}
                title="Refresh pages"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 text-muted-foreground",
                    loadingPages && "animate-spin",
                  )}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3">
            {loadingPages ? (
              <PagesSkeleton />
            ) : pages.length > 0 ? (
              <div className="space-y-1">
                {pages.map((page) => (
                  <PageListItem
                    key={page.id}
                    page={page}
                    isSelected={selectedPage?.id === page.id}
                    onSelect={setSelectedPage}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-3 text-center">
                <WifiOff className="h-4 w-4 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">No pages loaded</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={fetchPages}
                  disabled={!accessToken}
                >
                  Load Pages
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/*
          Conversations card:
          - flex-1 + min-h-0 fills remaining sidebar height
          - flex flex-col so CardContent can stretch
          - ScrollArea inside handles the actual scrolling
        */}
        {(selectedPage || loadingConversations) && (
          <Card className="border-border/60 shadow-none flex-1 min-h-0 flex flex-col overflow-hidden pt-1 gap-1">
            <CardHeader className="px-4 pt-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Conversations
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={fetchConversations}
                  disabled={loadingConversations || !selectedPage}
                  title="Refresh"
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3 text-muted-foreground",
                      loadingConversations && "animate-spin",
                    )}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
              {loadingConversations ? (
                <ConversationsSkeleton />
              ) : conversations.length > 0 ? (
                <ScrollArea className="h-full">
                  <div className="space-y-2 pr-2">
                    {conversations.map((conv) => (
                      <ConversationListItem
                        key={conv.id}
                        conversation={conv}
                        isSelected={selectedConversationId === conv.id}
                        onSelect={fetchMessages}
                        isLoading={loadingMessages}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-3 text-center">
                  <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    No conversations found
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {loadingMessages ? (
          <>
            <div className="flex items-center justify-between border-b bg-card px-5 py-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <MessagesSkeleton />
            </ScrollArea>
            <div className="flex items-center gap-2 border-t bg-card p-3 shrink-0">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            </div>
          </>
        ) : messages.length > 0 ? (
          <>
            {/* Header — shrink-0 pins it to top */}
            <div className="flex items-center justify-between border-b bg-card px-5 py-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {participants.find((p) => p.name !== PAGE_NAME_FILTER)
                      ?.name || "Conversation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    via {selectedPage?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-normal">
                  {messages.length} messages
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fetchMessages(selectedConversationId)}
                  disabled={loadingMessages}
                  title="Refresh messages"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground",
                      loadingMessages && "animate-spin",
                    )}
                  />
                </Button>
              </div>
            </div>

            {/* Messages — only this ScrollArea scrolls */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col gap-2.5 px-5 py-4">
                {[...messages].reverse().map((msg) => (
                  <Bubble
                    key={msg.id}
                    message={msg}
                    isFromPage={msg.from?.id === selectedPage?.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input — shrink-0 pins it to bottom */}
            <div className="border-t bg-card p-3 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  value={outMessage}
                  onChange={(e) => setOutMessage(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
                  placeholder="Type a message…"
                  className="flex-1 bg-background focus-visible:ring-1"
                  disabled={sendingMessage}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={sendingMessage || !outMessage.trim()}
                  className="shrink-0"
                >
                  {sendingMessage ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
              <MessageCircle className="h-7 w-7 opacity-30" />
              {selectedPage && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Wifi className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground text-sm">
                {selectedPage ? "Select a conversation" : "No page selected"}
              </p>
              <p className="text-xs max-w-[200px] leading-relaxed">
                {selectedPage
                  ? "Choose a conversation from the sidebar to start messaging"
                  : "Load your Facebook pages to get started"}
              </p>
            </div>
            {!selectedPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPages}
                disabled={loadingPages || !accessToken}
                className="gap-2"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loadingPages && "animate-spin")}
                />
                Load Pages
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessengerTab;
