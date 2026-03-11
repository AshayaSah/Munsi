import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WebhookMessageItemProps } from "@/types/dashboard.types";

const WebhookMessageItem: React.FC<WebhookMessageItemProps> = ({
  message,
  index,
}) => {
  const initials = message.sender_id.substring(0, 2).toUpperCase();
  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
  ];
  const colorClass =
    colors[parseInt(message.sender_id, 36) % colors.length] ??
    colors[index % colors.length];

  return (
    <div className="group py-3 px-3 rounded-lg hover:bg-accent/40 transition-all duration-150 border mx-auto w-full last:border-0">
      {/* ── User row ── */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground text-[11px] font-semibold shadow-sm",
            colorClass,
          )}
        >
          {initials}
        </div>
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {message.sender_id}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* ── User bubble ── */}
      {message.message_text && (
        <div className="ml-9 text-xs text-foreground bg-muted rounded-lg rounded-tl-sm px-3 py-2 leading-relaxed w-fit max-w-[85%]">
          {message.message_text}
        </div>
      )}

      {/* ── Meta ── */}
      {/* <div className="ml-9 mt-1.5 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[180px]">
          {message.message_id ?? "no-id"}
        </span>
        {message.attachments?.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            📎 {message.attachments.length}
          </Badge>
        )}
      </div> */}

      {/* ── AI reply ── */}
      {message.ai_reply && (
        <div className="ml-9 mt-3 ">
          {/* AI label row */}
          <div className="flex items-center justify-end gap-1.5 mb-1.5">
            <Badge
              variant={message.ai_status === "sent" ? "outline" : "destructive"}
              className="text-[10px] h-4 px-1.5"
            >
              {message.ai_status === "sent" ? "✓ sent" : "✗ failed"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">AI Reply</span>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
              AI
            </div>
          </div>
          {/* AI bubble — right aligned */}
          <div className="flex justify-end">
            <div className="text-xs text-foreground bg-primary/10 border border-primary/20 rounded-lg rounded-tr-sm px-3 py-2 leading-relaxed max-w-[85%]">
              {message.ai_reply}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhookMessageItem;
