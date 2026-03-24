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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  MoreHorizontal,
  RefreshCw,
  Search,
  Users,
  MessageSquare,
  Phone,
  MapPin,
  Trash2,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  fmt,
  timeAgo,
  type UserRow,
  type PaginatedResponse,
  type ConversationOut,
  type LeadRow,
} from "@/lib/admin_api";
import {
  RowSkeleton,
  Pagination,
  SectionHeader,
  EmptyState,
  LeadBadge,
  ConfidenceBar,
} from "./shared";

interface Props {
  token: string;
}

export function UsersPage({ token }: Props) {
  const [data, setData] = useState<PaginatedResponse<UserRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [blockedFilter, setBlockedFilter] = useState<
    "all" | "active" | "blocked"
  >("all");

  const [convoUser, setConvoUser] = useState<UserRow | null>(null);
  const [convo, setConvo] = useState<ConversationOut | null>(null);
  const [convoLoading, setConvoLoading] = useState(false);

  const [clearChatId, setClearChatId] = useState<number | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (search) params.set("search", search);
    if (blockedFilter === "active") params.set("is_blocked", "false");
    if (blockedFilter === "blocked") params.set("is_blocked", "true");
    api<PaginatedResponse<UserRow>>(`/users?${params}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, search, blockedFilter, token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function toggleBlock(u: UserRow) {
    await api(`/users/${u.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_blocked: !u.is_blocked }),
    });
    load();
  }

  async function openConvo(u: UserRow) {
    setConvoUser(u);
    setConvo(null);
    setConvoLoading(true);
    try {
      const c = await api<ConversationOut>(
        `/users/${u.id}/conversation`,
        token,
      );
      setConvo(c);
    } finally {
      setConvoLoading(false);
    }
  }

  async function clearChat() {
    if (!clearChatId) return;
    await api(`/users/${clearChatId}/messages`, token, { method: "DELETE" });
    setClearChatId(null);
    load();
    if (convoUser?.id === clearChatId)
      setConvo((prev) => (prev ? { ...prev, messages: [] } : null));
  }

  async function deleteUser() {
    if (!deleteUserId) return;
    await api(`/users/${deleteUserId}`, token, { method: "DELETE" });
    setDeleteUserId(null);
    if (convoUser?.id === deleteUserId) setConvoUser(null);
    load();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Users"
        description="Everyone who has messaged your pages"
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form
          onSubmit={handleSearch}
          className="flex gap-2 flex-1 min-w-[200px] max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PSID or phone…"
              className="pl-9 h-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" className="h-9">
            Search
          </Button>
        </form>
        <div className="flex gap-1.5">
          {(["all", "active", "blocked"] as const).map((f) => (
            <Button
              key={f}
              variant={blockedFilter === f ? "default" : "outline"}
              size="sm"
              className="h-9 capitalize"
              onClick={() => {
                setBlockedFilter(f);
                setPage(1);
              }}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold">User</TableHead>
              <TableHead className="font-semibold">Contact on file</TableHead>
              <TableHead className="font-semibold">Last seen</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} cols={5} />
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState icon={Users} title="No users found" />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((u) => (
                <TableRow
                  key={u.id}
                  className="group cursor-pointer"
                  onClick={() => openConvo(u)}
                >
                  <TableCell>
                    <div>
                      <p className="font-mono text-xs font-medium">
                        {u.user_id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Page: <span className="font-mono">{u.page_id}</span>
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {u.remembered_phone && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{u.remembered_phone}</span>
                        </div>
                      )}
                      {u.remembered_address && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {u.remembered_address}
                          </span>
                        </div>
                      )}
                      {!u.remembered_phone && !u.remembered_address && (
                        <span className="text-xs text-muted-foreground italic">
                          None on file
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_seen ? timeAgo(u.last_seen) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        u.is_blocked
                          ? "bg-red-100 text-red-600 border-red-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }
                    >
                      {u.is_blocked ? "Blocked" : "Active"}
                    </Badge>
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
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openConvo(u)}>
                          <MessageSquare className="h-4 w-4 mr-2" /> View
                          conversation
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleBlock(u)}>
                          {u.is_blocked ? (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-2" /> Unblock
                            </>
                          ) : (
                            <>
                              <ShieldBan className="h-4 w-4 mr-2" /> Block
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setClearChatId(u.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Clear chat history
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteUserId(u.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
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

      {/* Conversation drawer */}
      <Sheet open={!!convoUser} onOpenChange={(o) => !o && setConvoUser(null)}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="font-mono text-sm">
              {convoUser?.user_id}
            </SheetTitle>
            <SheetDescription>
              {convoUser?.remembered_phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {convoUser.remembered_phone}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {convoLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`}
                    />
                  </div>
                ))}
              </div>
            ) : convo ? (
              <div className="flex flex-col">
                {/* Messages */}
                {convo.messages.length > 0 ? (
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Conversation · {convo.messages.length} messages
                    </p>
                    {convo.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.from_role === "user" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                          ${
                            m.from_role === "user"
                              ? "bg-muted text-foreground rounded-tl-sm"
                              : "bg-primary text-primary-foreground rounded-tr-sm"
                          }`}
                        >
                          <p>{m.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${m.from_role === "user" ? "text-muted-foreground" : "text-primary-foreground/70"}`}
                          >
                            {fmt(m.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    title="No messages"
                    description="Chat history has been cleared or no messages exist yet"
                  />
                )}

                {/* Orders */}
                {convo.leads.length > 0 && (
                  <div className="border-t p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Orders · {convo.leads.length}
                    </p>
                    {convo.leads.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {l.order_ref_id ?? `#${l.id}`}
                          </span>
                          <LeadBadge status={l.status} />
                        </div>
                        {l.product_interest && (
                          <p className="text-sm font-medium">
                            {l.product_interest}
                          </p>
                        )}
                        <div className="flex gap-3 flex-wrap">
                          {l.phone_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" /> {l.phone_number}
                            </div>
                          )}
                          {l.delivery_address && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[200px]">
                                {l.delivery_address}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(l.detected_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer actions */}
          {convoUser && (
            <div className="border-t p-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setClearChatId(convoUser.id)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Clear chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => toggleBlock(convoUser)}
              >
                {convoUser.is_blocked ? (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-1.5" /> Unblock
                  </>
                ) : (
                  <>
                    <ShieldBan className="h-4 w-4 mr-1.5" /> Block
                  </>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Clear chat confirm */}
      <AlertDialog
        open={!!clearChatId}
        onOpenChange={(o) => !o && setClearChatId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages for this user will be permanently deleted. The user
              row and orders will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user confirm */}
      <AlertDialog
        open={!!deleteUserId}
        onOpenChange={(o) => !o && setDeleteUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the user and <strong>all</strong> their
              messages and leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
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
