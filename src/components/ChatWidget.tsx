import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const CONV_KEY = "lk_chat_conv_id";
const SESSION_KEY = "lk_session_id";

function getSessionId() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, s); }
  return s;
}

const WELCOME: Msg = { role: "assistant", content: "Hi! I'm **Leafy** 🌿 — your wellness assistant. Ask me about products, ingredients, recipes, or your **order status** (just share your order ID)." };

const ChatWidget = () => {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Notify other floating widgets (e.g. WhatsApp button) so they can move out of the way on mobile
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("leafy-chat-open", { detail: { open } }));
  }, [open]);

  // Restore conversation on mount / user change
  useEffect(() => {
    const stored = localStorage.getItem(CONV_KEY);
    if (!stored) return;
    setConvId(stored);
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", stored)
        .order("created_at");
      if (data && data.length > 0) {
        setMessages([WELCOME, ...data.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role as "user" | "assistant", content: m.content }))]);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const reset = () => {
    localStorage.removeItem(CONV_KEY);
    setConvId(null);
    setMessages([WELCOME]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: next.slice(-12).map(m => ({ role: m.role, content: m.content })),
          conversation_id: convId,
          session_id: getSessionId(),
        }),
      });

      if (resp.status === 429) { toast.error("Too many messages — try again in a moment."); return; }
      if (resp.status === 402) { toast.error("AI temporarily unavailable."); return; }
      if (!resp.ok) { toast.error("Chat failed. Please try again."); return; }

      const data = await resp.json();
      if (data.conversation_id && data.conversation_id !== convId) {
        setConvId(data.conversation_id);
        localStorage.setItem(CONV_KEY, data.conversation_id);
      }
      setMessages(prev => [...prev, { role: "assistant", content: data.message || "(no reply)" }]);
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
              <p className="text-[11px] opacity-80">Wellness assistant • Live product & order lookup</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reset} className="hover:opacity-70" aria-label="New chat" title="New chat"><RotateCcw size={16} /></button>
              <button onClick={() => setOpen(false)} className="hover:opacity-70" aria-label="Close"><X size={18} /></button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_a]:text-secondary [&_a]:underline [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
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
