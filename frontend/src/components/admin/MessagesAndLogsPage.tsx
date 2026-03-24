import { useCallback, useEffect, useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Trash2,
  ScrollText,
  AlertCircle,
} from "lucide-react";
import {
  api,
  fmt,
  type MessageRow,
  type LogRow,
  type PaginatedResponse,
} from "@/lib/admin_api";
import { RowSkeleton, Pagination, SectionHeader, EmptyState } from "./shared";

// ── Messages page ─────────────────────────────────────────────────────────────

interface MessagesProps {
  token: string;
}

export function MessagesPage({ token }: MessagesProps) {
  const [data, setData] = useState<PaginatedResponse<MessageRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "ai">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (roleFilter !== "all") params.set("from_role", roleFilter);
    api<PaginatedResponse<MessageRow>>(`/messages?${params}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, roleFilter, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteMessage(id: number) {
    await api(`/messages/${id}`, token, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Messages"
        description="Full conversation history across all users and pages"
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="flex gap-1.5">
        {(["all", "user", "ai"] as const).map((r) => (
          <Button
            key={r}
            variant={roleFilter === r ? "default" : "outline"}
            size="sm"
            className="h-9 capitalize"
            onClick={() => {
              setRoleFilter(r);
              setPage(1);
            }}
          >
            {r === "all" ? "All" : r === "user" ? "Customer" : "AI"}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold w-14">#</TableHead>
              <TableHead className="font-semibold">From</TableHead>
              <TableHead className="font-semibold">Message</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Sent</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} cols={6} />
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={MessageSquare} title="No messages found" />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((m) => (
                <>
                  <TableRow
                    key={m.id}
                    className="group cursor-pointer"
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground tabular-nums font-mono">
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
                        {m.from_role === "user" ? "Customer" : "AI"}
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
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : m.status === "received"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-red-100 text-red-500 border-red-200"
                        }
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(m.sent_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteMessage(m.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expanded === m.id && (
                    <TableRow key={`${m.id}-expanded`} className="bg-muted/30">
                      <TableCell colSpan={6} className="py-3">
                        <div className="px-2 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Full message
                          </p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {m.content}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Page: <span className="font-mono">{m.page_id}</span>{" "}
                            · User ID: {m.user_id}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
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

// ── Logs page ─────────────────────────────────────────────────────────────────

interface LogsProps {
  token: string;
}

export function LogsPage({ token }: LogsProps) {
  const [data, setData] = useState<PaginatedResponse<LogRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unprocessed">("all");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (filter === "unprocessed") params.set("processed", "false");
    api<PaginatedResponse<LogRow>>(`/logs?${params}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, filter, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function clearProcessed() {
    await api("/logs/clear-processed", token, { method: "DELETE" });
    setClearConfirm(false);
    load();
  }

  async function deleteLog(id: number) {
    await api(`/logs/${id}`, token, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Webhook Logs"
        description="Raw incoming webhook events from Facebook"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setClearConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Clear processed
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        }
      />

      <div className="flex gap-1.5">
        {(["all", "unprocessed"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="h-9 capitalize"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f === "all" ? "All" : "Unprocessed"}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold w-14">#</TableHead>
              <TableHead className="font-semibold">Page</TableHead>
              <TableHead className="font-semibold">Processed</TableHead>
              <TableHead className="font-semibold">Error</TableHead>
              <TableHead className="font-semibold">Received</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} cols={6} />
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={ScrollText} title="No logs found" />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((l) => (
                <>
                  <TableRow
                    key={l.id}
                    className="group cursor-pointer"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground tabular-nums font-mono">
                      {l.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.page_id ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.is_processed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {l.error ? (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <p className="text-xs text-rose-600 truncate">
                            {l.error}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(l.received_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteLog(l.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expanded === l.id && (
                    <TableRow key={`${l.id}-expanded`} className="bg-muted/30">
                      <TableCell colSpan={6} className="py-3">
                        <div className="px-2 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Raw payload
                          </p>
                          <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48">
                            {(() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(l.raw_message),
                                  null,
                                  2,
                                );
                              } catch {
                                return l.raw_message;
                              }
                            })()}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
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

      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all processed logs?</AlertDialogTitle>
            <AlertDialogDescription>
              All successfully processed logs will be permanently deleted.
              Unprocessed logs will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearProcessed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
