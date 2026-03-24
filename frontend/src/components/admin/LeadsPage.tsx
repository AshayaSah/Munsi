import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  MoreHorizontal,
  RefreshCw,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  Trash2,
  Package,
  Edit,
} from "lucide-react";
import {
  api,
  fmt,
  timeAgo,
  type LeadRow,
  type PaginatedResponse,
  LEAD_STATUSES,
} from "@/lib/admin_api";
import {
  RowSkeleton,
  Pagination,
  SectionHeader,
  EmptyState,
  LeadBadge,
  ConfidenceBar,
} from "./shared";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";

interface Props {
  token: string;
  initialStatus?: string;
}

export function LeadsPage({ token, initialStatus }: Props) {
  const [data, setData] = useState<PaginatedResponse<LeadRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
  const [editForm, setEditForm] = useState({
    status: "",
    phone_number: "",
    delivery_address: "",
    product_interest: "",
    order_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    api<PaginatedResponse<LeadRow>>(`/leads?${params}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, statusFilter, search, token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((l) => l.id)));
    }
  }

  async function bulkDelete() {
    await api("/leads/bulk-delete", token, {
      method: "POST",
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }

  async function updateStatus(id: number, status: string) {
    await api(`/leads/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  function openEdit(l: LeadRow) {
    setEditLead(l);
    setEditForm({
      status: l.status,
      phone_number: l.phone_number ?? "",
      delivery_address: l.delivery_address ?? "",
      product_interest: l.product_interest ?? "",
      order_notes: l.order_notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editLead) return;
    setSaving(true);
    try {
      await api(`/leads/${editLead.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(editForm).filter(([, v]) => v !== ""),
          ),
        ),
      });
      setEditLead(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api(`/leads/${deleteId}`, token, { method: "DELETE" });
    setDeleteId(null);
    load();
  }

  const allSelected =
    !!data && selected.size === data.items.length && data.items.length > 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Orders & Leads"
        description="Confirmed orders and sales pipeline"
        action={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-9"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete {selected.size}
              </Button>
            )}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form
          onSubmit={handleSearch}
          className="flex gap-2 flex-1 min-w-[200px] max-w-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search phone, product, address, ref…"
              className="pl-9 h-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" className="h-9">
            Search
          </Button>
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...LEAD_STATUSES].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-9 capitalize"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="font-semibold">Order</TableHead>
              <TableHead className="font-semibold">Product</TableHead>
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="font-semibold">Confidence</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} cols={8} />
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={ShoppingCart}
                    title="No leads found"
                    description="Confirmed orders will appear here"
                  />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((l) => (
                <TableRow key={l.id} className="group">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleSelect(l.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-mono text-xs font-semibold">
                        {l.order_ref_id ?? `#${l.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        User {l.user_id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <p className="text-sm truncate">
                      {l.product_interest ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </p>
                    {l.order_notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {l.order_notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {l.phone_number && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {l.phone_number}
                        </div>
                      )}
                      {l.delivery_address && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[160px]">
                            {l.delivery_address}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ConfidenceBar value={l.confidence} />
                  </TableCell>
                  <TableCell>
                    <LeadBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(l.updated_at)}
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
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => openEdit(l)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit order
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {LEAD_STATUSES.filter((s) => s !== l.status).map(
                          (s) => (
                            <DropdownMenuItem
                              key={s}
                              className="capitalize"
                              onClick={() => updateStatus(l.id, s)}
                            >
                              <Package className="h-4 w-4 mr-2" /> Mark as {s}
                            </DropdownMenuItem>
                          ),
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(l.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
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
      <Sheet open={!!editLead} onOpenChange={(o) => !o && setEditLead(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit order</SheetTitle>
            <SheetDescription>
              {editLead?.order_ref_id ?? `#${editLead?.id}`}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`px-3 py-1.5 rounded-lg text-xs border capitalize font-medium transition-all
                      ${editForm.status === s ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
                    onClick={() => setEditForm((f) => ({ ...f, status: s }))}
                  >
                    <LeadBadge status={s} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Product interest</Label>
              <Input
                value={editForm.product_interest}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    product_interest: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input
                value={editForm.phone_number}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone_number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery address</Label>
              <Textarea
                rows={3}
                value={editForm.delivery_address}
                className="resize-none"
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    delivery_address: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={editForm.order_notes}
                className="resize-none"
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, order_notes: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditLead(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={bulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
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
