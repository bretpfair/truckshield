import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, RefreshCw, TriangleAlert, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { EmailStatusBadge } from "./EmailStatusBadge";

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

// Status palette centralized in <EmailStatusBadge />.
export const statusClasses: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  sent: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  dlq: "bg-destructive/10 text-destructive border-destructive/20",
  rate_limited: "bg-warning/10 text-warning border-warning/20",
  suppressed: "bg-muted text-muted-foreground border-border",
  bounced: "bg-destructive/10 text-destructive border-destructive/20",
  complained: "bg-destructive/10 text-destructive border-destructive/20",
  queued: "bg-warning/10 text-warning border-warning/20",
};

const getMetadata = (row: EmailLogRow) => (row.metadata || {}) as Record<string, any>;

export const getInviteToken = (row: EmailLogRow): string | null => {
  const meta = getMetadata(row);
  const templateData = meta.templateData || meta.template_data || {};
  if (templateData.inviteToken || templateData.invite_token) {
    return templateData.inviteToken || templateData.invite_token;
  }
  const portalLink = templateData.portalLink || templateData.portal_link;
  if (typeof portalLink !== "string") return null;
  try {
    const url = new URL(portalLink);
    const direct = url.searchParams.get("invite");
    if (direct) return direct;
    const redirect = url.searchParams.get("redirect_to") || url.searchParams.get("redirectTo");
    if (redirect) return getInviteToken({ ...row, metadata: { templateData: { portalLink: decodeURIComponent(redirect) } } });
  } catch {
    const direct = portalLink.match(/[?&]invite=([^&#]+)/i)?.[1];
    if (direct) return decodeURIComponent(direct);
  }
  return null;
};

export const canResendEmailRow = (row: EmailLogRow) => {
  const meta = getMetadata(row);
  const hasTemplateData = !!(meta.templateData || meta.template_data);

  // Old activity fallback rows do not contain the generated invite portalLink.
  // Do not resend those with a generic /client link because it will not sign in
  // a pending invitee. Fresh rows include templateData and remain resendable.
  if (row.template_name === "client-portal-invite" && (!hasTemplateData || !getInviteToken(row))) return false;

  return true;
};

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
    message_id: meta.message_id || meta.email_log_id || meta.queue_id || `activity-${row.id}`,
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      if (!canResendEmailRow(row)) throw new Error("This older invite row is missing the original invite link. Send a fresh invite instead.");

      const meta = getMetadata(row);
      const templateData = meta.templateData || meta.template_data || fallbackTemplateData(row);
      const inviteToken = row.template_name === "client-portal-invite" ? getInviteToken(row) : null;
      const resendTemplateData = inviteToken
        ? { ...templateData, inviteToken, portalLink: `${window.location.origin}/auth?invite=${inviteToken}` }
        : templateData;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: row.template_name,
          recipientEmail: row.recipient_email,
          accountId,
          idempotencyKey: `resend-${row.message_id || row.id}-${Date.now()}`,
          templateData: resendTemplateData,
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
      <div id="email-delivery-anchor" />
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
                  const canResend = canResendEmailRow(row);
                  const rowKey = row.message_id || row.id;
                  const isOpen = !!expanded[rowKey];
                  const isFailure = ["failed", "bounced", "dlq", "complained"].includes(row.status);
                  const shortError = row.error_message
                    ? row.error_message.split(/[\n.]/)[0].slice(0, 120)
                    : null;
                  const providerId = meta.provider_message_id || meta.providerMessageId || null;

                  return (
                    <>
                    <tr key={rowKey} className="border-b last:border-0 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {format(new Date(row.created_at), "MMM d, h:mm a")}
                      </td>
                      <td className="py-3 pr-3 font-medium">{row.template_name}</td>
                      <td className="py-3 pr-3 break-all">{row.recipient_email}</td>
                      <td className="py-3 pr-3 break-all text-muted-foreground">{cc}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <EmailStatusBadge status={row.status} />
                          {isFailure && shortError && (
                            <span className="text-[11px] text-destructive truncate max-w-[260px]" title={row.error_message || undefined}>
                              {shortError}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => setExpanded((m) => ({ ...m, [rowKey]: !m[rowKey] }))}
                          aria-expanded={isOpen}
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          Details
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={resend.isPending || !canResend}
                          title={canResend ? undefined : "Send a fresh invite instead"}
                          onClick={() => resend.mutate(row)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Resend
                        </Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${rowKey}-details`} className="border-b last:border-0 bg-muted/20">
                        <td colSpan={6} className="py-2 px-3">
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono">
                            {row.message_id && <Detail label="Message ID" value={row.message_id} />}
                            {providerId && <Detail label="Provider ID" value={String(providerId)} />}
                            {meta.account_id && <Detail label="Account" value={meta.account_id} />}
                            {meta.idempotency_key && <Detail label="Idempotency" value={meta.idempotency_key} />}
                            {(meta.email_log_id || meta.activity_fallback) && (
                              <Detail label="Source" value={meta.activity_fallback ? "activity_log fallback" : "email_send_log"} />
                            )}
                            {row.error_message && (
                              <div className="sm:col-span-2">
                                <dt className="text-muted-foreground">Error</dt>
                                <dd className="break-all text-destructive whitespace-pre-wrap">{row.error_message}</dd>
                              </div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    )}
                    </>
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

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="break-all">{value}</dd>
  </div>
);
