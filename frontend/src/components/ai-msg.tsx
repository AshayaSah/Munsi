import { Bot, RefreshCw, Send, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { useState } from "react";

const API_BASE_URL = "http://localhost:8000";

const AIMsg = () => {
  const [aimsg, setAimsg] = useState<string>("");
  const [aires, setAires] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ── AI response ────────────────────────────────────────────────────────
  const getAiRes = async (): Promise<void> => {
    if (!aimsg.trim()) return;
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/get_ai_res`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: aimsg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAires(data.reply as string);
      setAimsg("");
    } catch (err) {
      setError((err as Error).message || "Failed to get AI response");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card className="shadow-none border-border/60">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-3 w-3 text-primary" />
          </div>
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            AI Agent Test
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className="flex gap-2">
          <Input
            value={aimsg}
            onChange={(e) => setAimsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && getAiRes()}
            placeholder="Ask the AI agent something…"
            className="flex-1 bg-background text-sm focus-visible:ring-1 h-8"
            disabled={aiLoading}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={getAiRes}
            disabled={aiLoading || !aimsg.trim()}
          >
            {aiLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {aires && (
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3 w-3 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Agent reply
              </p>
            </div>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {aires}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default AIMsg;
