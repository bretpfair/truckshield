import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailDeliveryLog from "./EmailDeliveryLog";
import {
  MessageSquare, StickyNote, ArrowRightLeft, FileText, Send, UserPlus, Mail, TriangleAlert, LogIn, Shield, ChevronDown,
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
  coverwhale_api: Shield,
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
  coverwhale_api: "text-primary",
};

interface TimelineEntry {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata?: any;
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
        .select("id, action_type, description, created_at, metadata")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as TimelineEntry[];
    },
  });

  const INVITE_GROUP_TYPES = new Set([
    "client_invite_sent",
    "client_invite_resent",
    "email_queued",
    "email_sent",
    "email_failed",
    "client_linked",
  ]);

  // Same-type, same-minute collapse — primarily for noisy login/accepted streams.
  const MINUTE_GROUP_TYPES = new Set([
    "client_login",
    "client_linked",
  ]);

  type Group = { kind: "single"; entry: TimelineEntry } | { kind: "group"; entries: TimelineEntry[]; key: string };

  const grouped: Group[] = useMemo(() => {
    if (!timeline) return [];
    const out: Group[] = [];
    let buf: TimelineEntry[] = [];
    const flush = () => {
      if (!buf.length) return;
      if (buf.length === 1) out.push({ kind: "single", entry: buf[0] });
      else out.push({ kind: "group", entries: buf, key: buf[0].id });
      buf = [];
    };
    const bufKey = (e: TimelineEntry): string | null => {
      const mid = e.metadata?.message_id || e.metadata?.email_log_id;
      if (mid) return `mid:${mid}`;
      // 10-min window fallback by template + recipient
      const tpl = e.metadata?.template_name;
      const rec = e.metadata?.recipient || e.metadata?.recipient_email;
      if (tpl && rec) return `tr:${tpl}:${rec}`;
      return null;
    };
    for (const e of timeline) {
      const inInvite = INVITE_GROUP_TYPES.has(e.action_type);
      const inMinute = MINUTE_GROUP_TYPES.has(e.action_type);
      if (!inInvite && !inMinute) { flush(); out.push({ kind: "single", entry: e }); continue; }
      if (!buf.length) { buf.push(e); continue; }
      const head = buf[0];
      const headInvite = INVITE_GROUP_TYPES.has(head.action_type);
      const headMinute = MINUTE_GROUP_TYPES.has(head.action_type);
      const dt = Math.abs(new Date(head.created_at).getTime() - new Date(e.created_at).getTime());
      let canMerge = false;
      if (inInvite && headInvite) {
        const sameKey = bufKey(head) && bufKey(head) === bufKey(e);
        canMerge = !!sameKey || dt <= 10 * 60 * 1000;
      } else if (inMinute && headMinute && head.action_type === e.action_type) {
        canMerge = dt <= 60 * 1000;
      }
      if (canMerge) buf.push(e);
      else { flush(); buf.push(e); }
    }
    flush();
    return out;
  }, [timeline]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
    <>
      <EmailDeliveryLog accountId={accountId} />

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
              {grouped.map((g) => {
                if (g.kind === "single") {
                  const entry = g.entry;
                  const Icon = actionIcons[entry.action_type] || StickyNote;
                  const color = actionColors[entry.action_type] || "text-muted-foreground";
                  const isEmailEvent = entry.action_type === "email_sent" || entry.action_type === "email_failed";
                  return (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <div className={`mt-0.5 shrink-0 ${color}`}><Icon className="h-4 w-4" /></div>
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
                }
                // grouped
                const entries = g.entries;
                const latest = entries[0];
                const isMinuteGroup = MINUTE_GROUP_TYPES.has(latest.action_type)
                  && entries.every((e) => e.action_type === latest.action_type);
                const final = entries.find((e) => e.action_type === "email_failed")
                  || entries.find((e) => e.action_type === "email_sent")
                  || entries.find((e) => e.action_type === "client_linked")
                  || latest;
                const recipient = latest.metadata?.recipient || latest.metadata?.recipient_email || "";
                const open = !!openGroups[g.key];
                const tone = isMinuteGroup
                  ? (actionColors[latest.action_type] || "text-primary")
                  : final.action_type === "email_failed" ? "text-destructive"
                  : final.action_type === "client_linked" ? "text-success"
                  : final.action_type === "email_sent" ? "text-accent" : "text-primary";
                const GroupIcon = isMinuteGroup
                  ? (actionIcons[latest.action_type] || Mail)
                  : Mail;
                const summary = isMinuteGroup
                  ? `${entries.length}× ${latest.action_type.replace(/_/g, " ")}`
                  : `Portal invite${recipient ? ` — ${recipient}` : ""} · ${final.action_type.replace(/_/g, " ")}`;
                const groupBadge = isMinuteGroup
                  ? (latest.action_type === "client_login" ? "Login" : "Accepted")
                  : "Invite";
                return (
                  <div key={g.key} className="text-sm">
                    <button
                      type="button"
                      className="w-full flex gap-3 items-start text-left hover:bg-muted/30 rounded px-1 -mx-1 py-0.5"
                      onClick={() => setOpenGroups((m) => ({ ...m, [g.key]: !m[g.key] }))}
                      aria-expanded={open}
                    >
                      <div className={`mt-0.5 shrink-0 ${tone}`}><GroupIcon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground flex items-center gap-1.5">
                          {summary}
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {entries.length} events · latest {format(new Date(latest.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">{groupBadge}</Badge>
                    </button>
                    {open && (
                      <div className="mt-2 ml-7 pl-3 border-l border-border space-y-2">
                        {entries.map((entry) => {
                          const Icon = actionIcons[entry.action_type] || StickyNote;
                          const color = actionColors[entry.action_type] || "text-muted-foreground";
                          return (
                            <div key={entry.id} className="flex gap-2 text-xs">
                              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground">{entry.description}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{format(new Date(entry.created_at), "MMM d, h:mm a")}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
    </>
  );
};

export default ActivityLog;
