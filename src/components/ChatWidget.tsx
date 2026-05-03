import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm Leafy 🌿 — your wellness assistant. Ask me about products, recipes, or your order!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    let assistantStarted = false;
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        if (assistantStarted) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        assistantStarted = true;
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });

      if (resp.status === 429) { toast.error("Too many messages — try again in a moment."); setLoading(false); return; }
      if (resp.status === 402) { toast.error("AI temporarily unavailable."); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Chat failed. Please try again."); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-40 bg-secondary text-secondary-foreground rounded-full p-4 shadow-lg hover:scale-110 transition-transform"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 left-6 z-40 w-[90vw] max-w-sm h-[70vh] max-h-[560px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div>
              <h4 className="font-semibold text-sm">Leafy 🌿</h4>
              <p className="text-[11px] opacity-80">Your wellness assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70" aria-label="Close"><X size={18} /></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"}`}>
                  {m.content || <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start"><div className="bg-muted rounded-2xl px-3 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
            )}
          </div>
          <div className="p-3 border-t flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Ask anything…"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-secondary/50"
              disabled={loading}
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()}><Send size={16} /></Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;