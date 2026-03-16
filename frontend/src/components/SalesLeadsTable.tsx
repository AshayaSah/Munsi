import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  ShoppingBag,
  User,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacebookPage {
  id: string;
  name: string;
}

type LeadStatus =
  | "interested"
  | "collecting"
  | "pending"
  | "confirmed"
  | "cancelled";

interface SalesLead {
  id: number;
  page_id: string;
  user_id: number;
  status: LeadStatus;
  confidence: number | null;
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: string | null;
  product_interest: string | null;
  order_notes: string | null;
  trigger_message: string | null;
  detected_at: string;
  updated_at: string;
}

interface LeadListResponse {
  total: number;
  page: number;
  page_size: number;
  items: SalesLead[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> =
  {
    interested: {
      label: "Interested",
      className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100",
    },
    collecting: {
      label: "Collecting",
      className:
        "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
    },
    pending: {
      label: "Pending",
      className:
        "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100",
    },
    confirmed: {
      label: "Confirmed",
      className:
        "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-red-100 text-red-500 border-red-200 hover:bg-red-100",
    },
  };

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "interested", label: "Interested" },
  { value: "collecting", label: "Collecting" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 45 ? "bg-yellow-500" : "bg-red-400";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pct}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Detection confidence: {pct}%</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LeadDetailIcons({ lead }: { lead: SalesLead }) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {lead.customer_name && (
          <Tooltip>
            <TooltipTrigger>
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>{lead.customer_name}</TooltipContent>
          </Tooltip>
        )}
        {lead.phone_number && (
          <Tooltip>
            <TooltipTrigger>
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>{lead.phone_number}</TooltipContent>
          </Tooltip>
        )}
        {lead.delivery_address && (
          <Tooltip>
            <TooltipTrigger>
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-48">
              {lead.delivery_address}
            </TooltipContent>
          </Tooltip>
        )}
        {lead.product_interest && (
          <Tooltip>
            <TooltipTrigger>
              <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-48">
              {lead.product_interest}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SalesLeadsTable() {
  // ── Page selector state ────────────────────────────────────────────────────
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [pageError, setPageError] = useState("");

  // ── Leads state ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { user } = useAuth();

  // ── 1. Fetch FB pages on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchPages = async () => {
      // Adjust this to however your app stores the token
      const accessToken = user?.accessToken;

      if (!accessToken) {
        setPageError("No access token found.");
        setLoadingPages(false);
        return;
      }
      setLoadingPages(true);
      setPageError("");
      try {
        const res = await fetch(
          `${API_BASE}/api/user/pages?access_token=${accessToken}`,
        );
        if (!res.ok) throw new Error("Failed to fetch pages");
        const data = await res.json();
        const fetched: FacebookPage[] = data.pages || [];
        setPages(fetched);
        if (fetched.length > 0)
          setSelectedPage(fetched[0]); // auto-select first
        else setPageError("No Facebook Pages found.");
      } catch (err) {
        setPageError(`Error fetching pages: ${(err as Error).message}`);
      } finally {
        setLoadingPages(false);
      }
    };

    fetchPages();
  }, []);

  // ── 2. Fetch leads when selected page / filters / pagination change ────────
  useEffect(() => {
    if (!selectedPage) return;
    fetchLeads();
  }, [selectedPage?.id, currentPage, statusFilter]);

  // ── 3. Reset to page 1 when page or status changes ────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPage?.id, statusFilter]);

  async function fetchLeads() {
    if (!selectedPage) return;
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams({
        page_id: selectedPage.id,
        page: String(currentPage),
        page_size: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`${API_BASE}/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data: LeadListResponse = await res.json();
      setLeads(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  }

  // ── 4. Inline status update ────────────────────────────────────────────────
  async function updateStatus(id: number, status: LeadStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_BASE}/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated: SalesLead = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  }

  // ── Client-side search ─────────────────────────────────────────────────────
  const filtered = search.trim()
    ? leads.filter((l) => {
        const q = search.toLowerCase();
        return (
          l.customer_name?.toLowerCase().includes(q) ||
          l.phone_number?.includes(q) ||
          l.product_interest?.toLowerCase().includes(q) ||
          l.trigger_message?.toLowerCase().includes(q)
        );
      })
    : leads;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Page selector dropdown */}
          <Select
            value={selectedPage?.id ?? ""}
            onValueChange={(id) =>
              setSelectedPage(pages.find((p) => p.id === id) ?? null)
            }
            disabled={loadingPages || pages.length === 0}
          >
            <SelectTrigger className="w-52 h-9">
              {loadingPages ? (
                <span className="text-muted-foreground text-sm">
                  Loading pages…
                </span>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Select a page" />
                </div>
              )}
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name, phone, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
              disabled={!selectedPage}
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            disabled={!selectedPage}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right: count + refresh */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectedPage && !loadingLeads && <span>{total} leads</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchLeads}
            disabled={loadingLeads || !selectedPage}
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingLeads ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Page error */}
      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      {/* ── Table ── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product Interest</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPages || loadingLeads ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))
            ) : !selectedPage ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  Select a page to view leads.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  No leads found for{" "}
                  <span className="font-medium">{selectedPage.name}</span>.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => {
                const cfg = STATUS_CONFIG[lead.status];
                const isUpdating = updatingId === lead.id;

                return (
                  <TableRow key={lead.id} className="group">
                    {/* ID */}
                    <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                      {lead.id}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm leading-tight">
                          {lead.customer_name ?? (
                            <span className="text-muted-foreground italic font-normal">
                              Unknown
                            </span>
                          )}
                        </span>
                        {lead.phone_number && (
                          <span className="text-xs text-muted-foreground">
                            {lead.phone_number}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Product Interest */}
                    <TableCell className="max-w-48">
                      <p className="text-sm truncate">
                        {lead.product_interest ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                    </TableCell>

                    {/* Detail icons */}
                    <TableCell>
                      <LeadDetailIcons lead={lead} />
                    </TableCell>

                    {/* Confidence */}
                    <TableCell>
                      <ConfidenceBar value={lead.confidence} />
                    </TableCell>

                    {/* Status badge */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium border ${cfg.className} ${
                          isUpdating ? "opacity-50" : ""
                        }`}
                      >
                        {cfg.label}
                      </Badge>
                    </TableCell>

                    {/* Updated at */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(lead.updated_at)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isUpdating}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(
                            Object.entries(STATUS_CONFIG) as [
                              LeadStatus,
                              (typeof STATUS_CONFIG)[LeadStatus],
                            ][]
                          )
                            .filter(([s]) => s !== lead.status)
                            .map(([s, c]) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => updateStatus(lead.id, s)}
                              >
                                Mark as {c.label}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loadingLeads}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loadingLeads}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
