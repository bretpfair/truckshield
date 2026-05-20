import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Mail, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { activityEmailToLogRow, canResendEmailRow, dedupeEmailRows, type EmailLogRow } from "@/components/staff/EmailDeliveryLog";

const PAGE_SIZE = 50;

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

const activityTypesByStatus: Record<string, string[]> = {
  all: ["email_queued", "email_sent", "email_failed"],
  pending: ["email_queued"],
  sent: ["email_sent"],
  failed: ["email_failed"],
};

const getMetadata = (row: EmailLogRow) => (row.metadata || {}) as Record<string, any>;

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

const StaffEmailLog = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [template, setTemplate] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-email-send-log", status, template, fromDate, toDate, page],
    enabled: role === "admin",
    queryFn: async () => {
      let emailQuery = supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (status !== "all") emailQuery = emailQuery.eq("status", status);
      if (template !== "all") emailQuery = emailQuery.eq("template_name", template);
      if (fromDate) emailQuery = emailQuery.gte("created_at", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) emailQuery = emailQuery.lte("created_at", new Date(`${toDate}T23:59:59`).toISOString());

      let activityQuery = supabase
        .from("activity_log")
        .select("id, account_id, action_type, created_at, description, metadata")
        .in("action_type", activityTypesByStatus[status] || [])
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (fromDate) activityQuery = activityQuery.gte("created_at", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) activityQuery = activityQuery.lte("created_at", new Date(`${toDate}T23:59:59`).toISOString());

      const [emailResult, activityResult] = await Promise.all([emailQuery, activityQuery]);
      if (emailResult.error && activityResult.error) throw emailResult.error;

      const emailRows = (emailResult.data || []) as EmailLogRow[];
      let activityRows = ((activityResult.data || []) as any[]).map(activityEmailToLogRow);
      if (template !== "all") {
        activityRows = activityRows.filter((row) => row.template_name === template);
      }

      return [...emailRows, ...activityRows] as EmailLogRow[];
    },
  });

  const deduped = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const result = dedupeEmailRows(rows || []);
    if (!normalized) return result;

    return result.filter((row) => {
      const meta = getMetadata(row);
      return [row.recipient_email, row.template_name, row.message_id, meta.account_id, meta.activity_description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [rows, search]);

  const templates = useMemo(
    () => [...new Set((rows || []).map((row) => row.template_name).filter(Boolean))].sort(),
    [rows],
  );

  const resend = useMutation({
    mutationFn: async (row: EmailLogRow) => {
      if (!canResendEmailRow(row)) throw new Error("This older invite row is missing the original invite link. Send a fresh invite instead.");

      const meta = getMetadata(row);
      const accountId = meta.account_id;
      if (!accountId) throw new Error("This email row is not linked to an account.");

      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: row.template_name,
          recipientEmail: row.recipient_email,
          accountId,
          idempotencyKey: `resend-${row.message_id || row.id}-${Date.now()}`,
          templateData: meta.templateData || meta.template_data || fallbackTemplateData(row),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-email-send-log"] });
      toast({ title: "Email queued for resend" });
    },
    onError: (error: any) => {
      toast({ title: "Resend failed", description: error.message, variant: "destructive" });
    },
  });

  if (role !== "admin") {
    return (
      <Card className="glass-panel max-w-2xl mx-auto">
        <CardContent className="py-8 text-center text-muted-foreground">
          Admin access is required to view global email delivery.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Email Delivery
          </h1>
          <p className="text-sm text-muted-foreground">Recent transactional sends across all accounts.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/staff/accounts")}>Back to Accounts</Button>
      </div>

      <Card className="glass-panel">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search recipient, template, account id..."
                className="pl-10"
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "pending",
                  "sent",
                  "failed",
                  "dlq",
                  "rate_limited",
                  "suppressed",
                  "bounced",
                  "complained",
                ].map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={template} onValueChange={(value) => { setTemplate(value); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} />
              <Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Delivery Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading email delivery...</p>
          ) : deduped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No email rows match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Template</th>
                    <th className="py-2 pr-3">Recipient</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deduped.map((row) => {
                    const meta = getMetadata(row);
                    const statusClass = statusClasses[row.status] || "bg-secondary text-muted-foreground border-border";
                    const canResend = canResendEmailRow(row);

                    return (
                      <tr key={row.message_id || row.id} className="border-b last:border-0 align-top">
                        <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {format(new Date(row.created_at), "MMM d, h:mm a")}
                        </td>
                        <td className="py-3 pr-3 font-medium">{row.template_name}</td>
                        <td className="py-3 pr-3 break-all">{row.recipient_email}</td>
                        <td className="py-3 pr-3">
                          {meta.account_id ? (
                            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate(`/staff/accounts/${meta.account_id}`)}>
                              Open account
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] ${statusClass}`}>
                              {row.status.replace(/_/g, " ")}
                            </Badge>
                            {row.error_message && (
                              <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-label="Email error" title={row.error_message} />
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            disabled={resend.isPending || !meta.account_id || !canResend}
                            title={canResend ? undefined : "Send a fresh invite instead"}
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

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground font-mono">Page {page + 1}</span>
            <Button variant="outline" disabled={(rows || []).length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffEmailLog;
