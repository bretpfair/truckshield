import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, FileText, X, MessageSquare } from "lucide-react";

interface Props {
  accountId: string;
  isStaff: boolean;
}

interface Message {
  id: string;
  account_id: string;
  sender_id: string;
  content: string;
  is_staff: boolean;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
}

const AccountMessages = ({ accountId, isStaff }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${accountId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `account_id=eq.${accountId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", accountId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() && !file) return;
    if (!user) return;
    setSending(true);

    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${accountId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(path, file);
        if (uploadError) throw uploadError;
        attachmentPath = path;
        attachmentName = file.name;
      }

      const { error } = await supabase.from("messages").insert({
        account_id: accountId,
        sender_id: user.id,
        content: message.trim(),
        is_staff: isStaff,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
      });
      if (error) throw error;

      setMessage("");
      setFile(null);
    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const getDownloadUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Messages list */}
        <div
          ref={scrollRef}
          className="h-[300px] overflow-y-auto space-y-3 p-3 rounded-lg bg-secondary/30 border border-border"
        >
          {!messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-mono ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msg.is_staff ? "Staff" : "Client"} · {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                    {msg.attachment_path && (
                      <button
                        onClick={() => getDownloadUrl(msg.attachment_path!)}
                        className={`flex items-center gap-1.5 mt-1.5 text-xs underline ${
                          isMine ? "text-primary-foreground/80" : "text-primary"
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        {msg.attachment_name || "Download"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* File preview */}
        {file && (
          <div className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border text-sm">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={sending || (!message.trim() && !file)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountMessages;
