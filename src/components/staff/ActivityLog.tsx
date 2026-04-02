import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, StickyNote, ArrowRightLeft, FileText, Send, UserPlus, Mail, TriangleAlert, LogIn,
} from "lucide-react";
import { format } from "date-fns";

const actionIcons: Record<string, typeof MessageSquare> = {
  status_change: ArrowRightLeft,
  note: StickyNote,
  message_sent: MessageSquare,
  document_uploaded: FileText,
  quote_update: Send,
  client_linked: UserPlus,
  email_sent: Mail,
  email_failed: TriangleAlert,
  client_login: LogIn,
};

const actionColors: Record<string, string> = {
  status_change: "text-primary",
  note: "text-warning",
  message_sent: "text-accent",
  document_uploaded: "text-muted-foreground",
  quote_update: "text-success",
  client_linked: "text-primary",
  email_sent: "text-accent",
  email_failed: "text-destructive",
  client_login: "text-primary",
};

interface TimelineEntry {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
}

interface Props {
  accountId: string;
}

const ActivityLog = ({ accountId }: Props) => {
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: timeline } = useQuery({
    queryKey: ["activity_log", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action_type, description, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as TimelineEntry[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("activity_log").insert({
        account_id: accountId,
        user_id: user!.id,
        action_type: "note",
        description: content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      setNote("");
      toast({ title: "Note added" });
    },
  });

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" /> Notes & Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add an internal note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[60px] text-sm"
          />
          <Button
            size="sm"
            className="self-end"
            disabled={!note.trim()}
            onClick={() => addNote.mutate(note.trim())}
          >
            Add
          </Button>
        </div>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-3">
            {timeline?.map((entry) => {
              const Icon = actionIcons[entry.action_type] || StickyNote;
              const color = actionColors[entry.action_type] || "text-muted-foreground";
              const isEmailEvent = entry.action_type === "email_sent" || entry.action_type === "email_failed";

              return (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <div className={`mt-0.5 shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{entry.description}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  {entry.action_type === "note" && (
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">Note</Badge>
                  )}
                  {isEmailEvent && (
                    <Badge
                      variant="outline"
                      className={entry.action_type === "email_failed"
                        ? "text-[10px] h-5 shrink-0 bg-destructive/10 text-destructive border-destructive/20"
                        : "text-[10px] h-5 shrink-0 bg-accent/10 text-accent border-accent/20"}
                    >
                      Email
                    </Badge>
                  )}
                </div>
              );
            })}
            {(!timeline || timeline.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ActivityLog;
