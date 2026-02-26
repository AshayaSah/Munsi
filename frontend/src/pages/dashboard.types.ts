// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  isLoggedIn: boolean;
  accessToken: string;
  userName: string;
}

// ─── Facebook Pages ───────────────────────────────────────────────────────────

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export interface PagesResponse {
  pages: FacebookPage[];
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationParticipant {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  snippet: string;
  message_count: number;
  updated_time: string;
  participants: {
    data: ConversationParticipant[];
  };
}

export interface ConversationsResponse {
  data: Conversation[];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface MessageSender {
  id: string;
  name: string;
}

export interface FacebookMessage {
  id: string;
  message: string;
  created_time: string;
  from: MessageSender;
}

export interface MessagesResponse {
  messages: {
    data: FacebookMessage[];
  };
}

export interface SendMessageResponse {
  message_id: string;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export interface WebhookAttachment {
  type: string;
  payload: Record<string, unknown>;
}

export interface WebhookMessage {
  sender_id: string;
  recipient_id: string;
  message_id: string;
  message_text: string;
  attachments: WebhookAttachment[];
  timestamp: number;
}

export interface WebhookMessagesResponse {
  messages: WebhookMessage[];
  count: number;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface AiRequest {
  msg: string;
}

export interface AiResponse {
  reply: string;
}

// ─── Component Props ──────────────────────────────────────────────────────────

export type TabId = "messenger" | "webhook";

export interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export interface BubbleProps {
  message: FacebookMessage;
  isFromPage: boolean;
}

export interface PageListItemProps {
  page: FacebookPage;
  isSelected: boolean;
  onSelect: (page: FacebookPage) => void;
}

export interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string, participants: ConversationParticipant[]) => void;
}

export interface WebhookMessageItemProps {
  message: WebhookMessage;
  index: number;
}
