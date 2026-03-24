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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MoreHorizontal,
  RefreshCw,
  Globe,
  Power,
  Trash2,
  Settings,
} from "lucide-react";
import {
  api,
  fmt,
  type PageRow,
  type PaginatedResponse,
} from "@/lib/admin_api";
import { RowSkeleton, Pagination, SectionHeader, EmptyState } from "./shared";

interface Props {
  token: string;
}

export function PagesPage({ token }: Props) {
  const [data, setData] = useState<PaginatedResponse<PageRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState<PageRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", ai_instructions: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<PaginatedResponse<PageRow>>(`/pages?page=${page}&page_size=20`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(p: PageRow) {
    await api(`/pages/${p.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api(`/pages/${deleteId}`, token, { method: "DELETE" });
    setDeleteId(null);
    load();
  }

  function openEdit(p: PageRow) {
    setEditPage(p);
    setEditForm({ name: p.name, ai_instructions: p.ai_instructions ?? "" });
  }

  async function saveEdit() {
    if (!editPage) return;
    setSaving(true);
    try {
      await api(`/pages/${editPage.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditPage(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Pages"
        description="Manage your connected Facebook pages and their AI instructions"
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

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold">Page</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">AI Instructions</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
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
                  <EmptyState
                    icon={Globe}
                    title="No pages yet"
                    description="Connect a Facebook page to get started"
                  />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {p.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        p.is_active
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200"
                      }
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.ai_instructions ? (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {p.ai_instructions}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        None
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmt(p.created_at)}
                  </TableCell>
                  <TableCell>
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
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Settings className="h-4 w-4 mr-2" /> Edit
                          instructions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(p)}>
                          <Power className="h-4 w-4 mr-2" />
                          {p.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete page
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

      {/* Edit sheet */}
      <Sheet open={!!editPage} onOpenChange={(o) => !o && setEditPage(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit page</SheetTitle>
            <SheetDescription>{editPage?.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label>Page name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>AI instructions</Label>
              <Textarea
                rows={8}
                placeholder="Custom instructions for this page's AI bot…"
                value={editForm.ai_instructions}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    ai_instructions: e.target.value,
                  }))
                }
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                These are appended to the base system prompt for all
                conversations on this page.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditPage(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the page and <strong>all</strong>{" "}
              associated users, messages, leads, and logs. This cannot be
              undone.
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
