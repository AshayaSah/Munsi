// ── Config ────────────────────────────────────────────────────────────────────

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const TOKEN_KEY = "admin_token";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Stats {
  total_pages: number;
  active_pages: number;
  total_users: number;
  blocked_users: number;
  active_users_24h: number;
  total_messages: number;
  messages_today: number;
  total_logs: number;
  unprocessed_logs: number;
  total_leads: number;
  pending_leads: number;
  confirmed_leads: number;
  cancelled_leads: number;
  delivered_leads: number;
}

export interface PageStats {
  page_id: string;
  total_users: number;
  blocked_users: number;
  active_users_24h: number;
  total_messages: number;
  total_leads: number;
  confirmed_leads: number;
  pending_leads: number;
  cancelled_leads: number;
  delivered_leads: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface PageRow {
  id: string;
  name: string;
  is_active: boolean;
  ai_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: number;
  user_id: string;
  page_id: string;
  last_seen: string | null;
  is_blocked: boolean;
  remembered_phone: string | null;
  remembered_address: string | null;
  created_at: string;
}

export interface MessageRow {
  id: number;
  page_id: string;
  user_id: number;
  from_role: string;
  content: string;
  sent_at: string;
  status: string;
}

export interface LogRow {
  id: number;
  page_id: string | null;
  raw_message: string;
  is_processed: boolean;
  error: string | null;
  received_at: string;
}

export interface LeadRow {
  id: number;
  page_id: string;
  user_id: number;
  order_ref_id: string | null;
  status: string;
  confidence: number | null;
  phone_number: string | null;
  delivery_address: string | null;
  product_interest: string | null;
  order_notes: string | null;
  trigger_message: string | null;
  detected_at: string;
  updated_at: string;
}

export interface ConversationOut {
  user: UserRow;
  messages: MessageRow[];
  leads: LeadRow[];
}

// ── API client ────────────────────────────────────────────────────────────────

export async function api<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Formatters ────────────────────────────────────────────────────────────────

export const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ── Lead status config ────────────────────────────────────────────────────────

export const LEAD_STATUSES = [
  "interested",
  "collecting",
  "pending",
  "confirmed",
  "cancelled",
  "delivered",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_STYLES: Record<string, string> = {
  interested: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  collecting: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  pending:    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  confirmed:  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  cancelled:  "bg-red-100 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  delivered:  "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
};
