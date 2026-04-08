import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, X, Send, Bot, User, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/faq-chat`;

const SUGGESTED_QUESTIONS = [
  "What coverages do I need?",
  "How do I complete my application?",
  "What documents should I upload?",
  "How does the quoting process work?",
];

interface Props {
  accountId: string;
  onEscalate?: () => void;
}

const AiFaqChat = ({ accountId, onEscalate }: Props) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setShowEscalate(false);

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Connection error" }));
        throw new Error(err.error || "Failed to get response");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const updateAssistant = (content: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateAssistant(assistantContent.replace("[SUGGEST_ESCALATE]", "").trim());
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Check for escalation suggestion
      if (assistantContent.includes("[SUGGEST_ESCALATE]")) {
        setShowEscalate(true);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't process that. ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleEscalate = () => {
    setOpen(false);
    onEscalate?.();
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 p-0"
        aria-label="Open AI help chat"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] flex flex-col rounded-xl border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">AI Assistant</p>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Insurance FAQ
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground">
                Hi! I'm your insurance assistant. Ask me about coverages, your application, or how to use the portal.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs px-2.5 py-2 rounded-md border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex items-start gap-2", msg.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                msg.role === "assistant" ? "bg-primary/10" : "bg-secondary"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                msg.role === "assistant"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {showEscalate && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
            onClick={handleEscalate}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Message your agent for help
          </Button>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="text-sm h-9"
            disabled={isLoading}
          />
          <Button type="submit" size="sm" className="h-9 w-9 p-0 shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AiFaqChat;
