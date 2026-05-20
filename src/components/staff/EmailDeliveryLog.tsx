import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, RefreshCw, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export type EmailLogRow = {
  id: string;
  created_at: string;
  error_message: string | null;
  message_id: string | null;
  metadata: any;
  recipient_email: string;
  status: string;
  template_name: string;
};

type ActivityEmailRow = {
  id: string;
  account_id: string | null;
  action_type: string;
  created_at: string;
  description: string | null;
  metadata: any;
};

const statusClasses: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  sent: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  dlq: "bg-destructive/10 text-destructive border-destructive/20",
  rate_limited: "bg-warning/10 text-warning border-warning/20",
  suppressed: "bg-muted text-muted-foreground border-border",
  bounced: "bg-destructive/10 text-destructive border-destructive/20",
  complained: "bg-destructive/10 text-destructive border-destructive/20",
};

const getMetadata = (row: EmailLogRow) => (row.metadata || {}) as Record<string, any>;

const parseTemplateName = (description?: string | null) => {
  const match = description?.match(/Email\s+["']([^"']+)["']/i);
  return match?.[1] || "app email";
};

const parseRecipient = (description?: string | null) => {
  const match = description?.match(/\b(?:for|to)\s+([^\s,]+)/i);
  return match?.[1] || "recipient";
};

export const activityEmailToLogRow = (row: ActivityEmailRow): EmailLogRow => {
  const meta = (row.metadata || {}) as Record<string, any>;
  const status = row.action_type === "email_sent"
    ? "sent"
    : row.action_type === "email_failed"
      ? "failed"
      : "pending";
  const templateName = meta.template_name || parseTemplateName(row.description);
  const recipientEmail = meta.recipient || meta.recipient_email || parseRecipient(row.description);
  const accountId = meta.account_id || row.account_id;

  return {
    id: `activity-${row.id}`,
    created_at: row.created_at,
    error_message: meta.error || (status === "failed" ? row.description : null),
    message_id: meta.email_log_id || meta.queue_id || `activity-${row.id}`,
    metadata: {
      ...meta,
      ...(accountId ? { account_id: accountId } : {}),
      activity_id: row.id,
      activity_description: row.description,
      activity_fallback: true,
    },
    recipient_email: recipientEmail,
    status,
    template_name: templateName,
  };
};

export const dedupeEmailRows = (rows: EmailLogRow[]) => {
  const grouped = new Map<string, EmailLogRow>();

  for (const row of [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    const key = row.message_id || row.id;
    const existing = grouped.get(key);
    grouped.set(key, {
      ...(existing || row),
      ...row,
      metadata: {
        ...(existing ? getMetadata(existing) : {}),
        ...getMetadata(row),
      },
    });
  }

  return [...grouped.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

const fallbackTemplateData = (row: EmailLogRow) => {
  const meta = getMetadata(row);
  const firstName = row.recipient_email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return {
    firstName,
    portalLink: "https://truckshield.360riskpartners.com/client",
    carrierName: meta.carrierName || meta.carrier_name || "your carrier",
    newStatus: meta.newStatus || meta.new_status || "updated",
    requestDetails: meta.requestDetails || meta.request_details || meta.description || meta.activity_description || "Please review your portal for details.",
    companyName: meta.companyName || meta.company_name,
  };
};

const EmailDeliveryLog = ({ accountId, limit = 50 }: { accountId: string; limit?: number }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["email-send-log", accountId, limit],
    queryFn: async () => {
      const [emailResult, activityResult] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("*")
          .filter("metadata->>account_id", "eq", accountId)
          .order("created_at", { ascending: false })
          .limit(limit * 3),
        supabase
          .from("activity_log")
          .select("id, account_id, action_type, created_at, description, metadata")
          .eq("account_id", accountId)
          .in("action_type", ["email_queued", "email_sent", "email_failed"])
          .order("created_at", { ascending: false })
          .limit(limit * 3),
      ]);

      if (emailResult.error && activityResult.error) throw emailResult.error;
      const emailRows = (emailResult.data || []) as EmailLogRow[];
      const activityRows = ((activityResult.data || []) as ActivityEmailRow[]).map(activityEmailToLogRow);
      return [...emailRows, ...activityRows];
    },
  });

  const deduped = useMemo(() => dedupeEmailRows(rows || []).slice(0, limit), [rows, limit]);

  const resend = useMutation({
    mutationFn: async (row: EmailLogRow) => {
      const meta = getMetadata(row);
      const templateData = meta.templateData || meta.template_data || fallbackTemplateData(row);
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: row.template_name,
          recipientEmail: row.recipient_email,
          accountId,
          idempotencyKey: `resend-${row.message_id || row.id}-${Date.now()}`,
          templateData,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-send-log", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      toast({ title: "Email queued for resend" });
    },
    onError: (error: any) => {
      toast({ title: "Resend failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Email Delivery
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading email delivery history...</p>
        ) : deduped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No emails sent yet for this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">CC</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {deduped.map((row) => {
                  const meta = getMetadata(row);
                  const cc = Array.isArray(meta.cc) ? meta.cc.join(", ") : meta.cc || "-";
                  const statusClass = statusClasses[row.status] || "bg-secondary text-muted-foreground border-border";

                  return (
                    <tr key={row.message_id || row.id} className="border-b last:border-0 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {format(new Date(row.created_at), "MMM d, h:mm a")}
                      </td>
                      <td className="py-3 pr-3 font-medium">{row.template_name}</td>
                      <td className="py-3 pr-3 break-all">{row.recipient_email}</td>
                      <td className="py-3 pr-3 break-all text-muted-foreground">{cc}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] ${statusClass}`}>
                            {row.status.replace(/_/g, " ")}
                          </Badge>
                          {row.error_message && (
                            <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-label="Email error" title={row.error_message} />
                          )}
                        </div>
                        {meta.email_log_id || meta.activity_fallback ? (
                          <p className="text-[10px] text-muted-foreground mt-1">Activity linked</p>
                        ) : null}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={resend.isPending}
                          onClick={() => resend.mutate(row)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Resend
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailDeliveryLog;
