import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, DollarSign, FileText, Clock, CheckCircle2, XCircle, Send, AlertTriangle } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary border-primary/20", icon: Send },
  reviewing: { label: "Under Review", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  info_requested: { label: "Additional Info Requested", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertTriangle },
  quoted: { label: "Quoted", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  bound: { label: "Bound", color: "bg-success/20 text-success border-success/30", icon: CheckCircle2 },
};

interface Quote {
  id: string;
  carrier_id: string;
  status: string;
  match_score: number | null;
  premium_estimate: number | null;
  coverage_details: any;
  carriers?: { name: string } | null;
}

interface Props {
  accountId: string;
  quotes: Quote[];
}

const SubmittedMarkets = ({ accountId, quotes }: Props) => {
  const [uploadDialog, setUploadDialog] = useState<{ quoteId: string; carrierName: string } | null>(null);
  const [infoRequestDialog, setInfoRequestDialog] = useState<{ quoteId: string; carrierName: string } | null>(null);
  const [declineDialog, setDeclineDialog] = useState<{ quoteId: string; carrierName: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [submittingDecline, setSubmittingDecline] = useState(false);
  const [infoRequestDetails, setInfoRequestDetails] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submittingInfoRequest, setSubmittingInfoRequest] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ quoteId, status, carrierName }: { quoteId: string; status: string; carrierName: string }) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", quoteId);
      if (error) throw error;
      await supabase.from("activity_log").insert({
        account_id: accountId,
        action_type: "quote_update",
        description: `${carrierName} status changed to ${statusConfig[status]?.label || status}`,
      });

      // Send carrier status change email to client (info_requested has its own flow)
      if (status !== "info_requested") {
        try {
          const { data: account } = await supabase
            .from("accounts")
            .select("client_user_id, contact_email")
            .eq("id", accountId)
            .single();

          const clientEmail = account?.contact_email;
          if (clientEmail) {
            let firstName: string | undefined;
            if (account?.client_user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("user_id", account.client_user_id)
                .single();
              firstName = profile?.full_name?.split(" ")[0];
            }

            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "carrier-status-change",
                recipientEmail: clientEmail,
                idempotencyKey: `carrier-status-${quoteId}-${status}-${Date.now()}`,
                templateData: {
                  firstName,
                  carrierName,
                  newStatus: status,
                  portalLink: `${window.location.origin}/client`,
                },
              },
            });
          }
        } catch (emailErr) {
          console.error("Failed to send status change email:", emailErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      toast({ title: "Status updated" });
    },
  });

  const handleStatusChange = (quoteId: string, status: string, carrierName: string) => {
    if (status === "info_requested") {
      setInfoRequestDialog({ quoteId, carrierName });
      setInfoRequestDetails("");
      return;
    }
    if (status === "declined") {
      setDeclineDialog({ quoteId, carrierName });
      setDeclineReason("");
      return;
    }
    updateStatus.mutate({ quoteId, status, carrierName });
  };

  const handleSubmitDecline = async () => {
    if (!declineDialog || !declineReason.trim()) return;
    setSubmittingDecline(true);

    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "declined",
          coverage_details: { decline_reason: declineReason.trim() },
        })
        .eq("id", declineDialog.quoteId);
      if (error) throw error;

      await supabase.from("activity_log").insert({
        account_id: accountId,
        action_type: "quote_update",
        description: `${declineDialog.carrierName} declined: ${declineReason.trim()}`,
      });

      // Send carrier status change email to client
      try {
        const { data: account } = await supabase
          .from("accounts")
          .select("client_user_id, contact_email")
          .eq("id", accountId)
          .single();

        const clientEmail = account?.contact_email;
        if (clientEmail) {
          let firstName: string | undefined;
          if (account?.client_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", account.client_user_id)
              .single();
            firstName = profile?.full_name?.split(" ")[0];
          }

          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "carrier-status-change",
              recipientEmail: clientEmail,
              idempotencyKey: `carrier-declined-${declineDialog.quoteId}-${Date.now()}`,
              templateData: {
                firstName,
                carrierName: declineDialog.carrierName,
                newStatus: "declined",
                portalLink: `${window.location.origin}/client`,
              },
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send decline email:", emailErr);
      }

      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      toast({ title: "Market declined", description: "Reason has been recorded" });
      setDeclineDialog(null);
      setDeclineReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingDecline(false);
    }
  };

  const handleSubmitInfoRequest = async () => {
    if (!infoRequestDialog || !infoRequestDetails.trim()) return;
    setSubmittingInfoRequest(true);

    try {
      // Update quote status
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({ status: "info_requested" })
        .eq("id", infoRequestDialog.quoteId);
      if (quoteError) throw quoteError;

      // Insert info request record
      const { error: irError } = await supabase.from("info_requests").insert({
        account_id: accountId,
        quote_id: infoRequestDialog.quoteId,
        carrier_name: infoRequestDialog.carrierName,
        request_details: infoRequestDetails.trim(),
      });
      if (irError) throw irError;

      // Log activity
      await supabase.from("activity_log").insert({
        account_id: accountId,
        action_type: "quote_update",
        description: `${infoRequestDialog.carrierName} status changed to Additional Info Requested`,
      });

      // Get account to find client info for notification + email
      const { data: account } = await supabase
        .from("accounts")
        .select("client_user_id, contact_email, company_name")
        .eq("id", accountId)
        .single();

      // Create in-app notification for client
      if (account?.client_user_id) {
        await supabase.from("notifications").insert({
          user_id: account.client_user_id,
          account_id: accountId,
          type: "info_requested",
          title: "Additional Information Requested",
          message: `${infoRequestDialog.carrierName} has requested additional information: ${infoRequestDetails.trim()}`,
        });
      }

      // Send email notification to client
      const clientEmail = account?.contact_email;
      if (clientEmail) {
        // Get client name if available
        let firstName: string | undefined;
        if (account?.client_user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", account.client_user_id)
            .single();
          firstName = profile?.full_name?.split(" ")[0];
        }

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "additional-info-request",
            recipientEmail: clientEmail,
            idempotencyKey: `info-request-${infoRequestDialog.quoteId}-${Date.now()}`,
            templateData: {
              firstName,
              carrierName: infoRequestDialog.carrierName,
              requestDetails: infoRequestDetails.trim(),
              portalLink: `${window.location.origin}/client`,
            },
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });
      toast({ title: "Info request sent", description: "Client has been notified" });
      setInfoRequestDialog(null);
      setInfoRequestDetails("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingInfoRequest(false);
    }
  };

  const handleUploadQuote = async () => {
    if (!uploadDialog || !premiumAmount) return;
    setUploading(true);

    try {
      const premium = parseFloat(premiumAmount);
      if (isNaN(premium)) throw new Error("Invalid premium amount");

      let filePath: string | null = null;
      if (quoteFile) {
        const ext = quoteFile.name.split(".").pop();
        const path = `${accountId}/${uploadDialog.quoteId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("loss-runs")
          .upload(path, quoteFile, { upsert: true });
        if (uploadError) throw uploadError;
        filePath = path;
      }

      const updateData: any = {
        premium_estimate: premium,
        status: "quoted",
        published_at: new Date().toISOString(),
      };
      if (filePath) {
        updateData.coverage_details = { quote_file_path: filePath };
      }

      const { error } = await supabase
        .from("quotes")
        .update(updateData)
        .eq("id", uploadDialog.quoteId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      toast({ title: "Quote uploaded successfully" });
      setUploadDialog(null);
      setPremiumAmount("");
      setQuoteFile(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!quotes || quotes.length === 0) return null;

  return (
    <>
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Submitted Markets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {quotes.map((q) => {
            const cfg = statusConfig[q.status] || statusConfig.submitted;
            const StatusIcon = cfg.icon;
            return (
              <div key={q.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-4">
                  <StatusIcon className={`h-5 w-5 ${cfg.color.split(" ")[1]}`} />
                  <div>
                    <p className="font-semibold">{(q.carriers as any)?.name ?? "Unknown Carrier"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      {q.match_score != null && <span>Score: {q.match_score}</span>}
                      {q.premium_estimate != null && (
                        <span className="text-success font-semibold">
                          Premium: ${Number(q.premium_estimate).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {q.status === "declined" && (q.coverage_details as any)?.decline_reason && (
                      <p className="text-xs text-destructive mt-1">
                        Reason: {(q.coverage_details as any).decline_reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cfg.color}>
                    {cfg.label}
                  </Badge>
                  <Select
                    value={q.status}
                    onValueChange={(val) => handleStatusChange(q.id, val, (q.carriers as any)?.name ?? "Carrier")}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="reviewing">Under Review</SelectItem>
                      <SelectItem value="info_requested">Additional Info Requested</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="bound">Bound</SelectItem>
                    </SelectContent>
                  </Select>
                  {q.status !== "quoted" && q.status !== "bound" && q.status !== "declined" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        setUploadDialog({
                          quoteId: q.id,
                          carrierName: (q.carriers as any)?.name ?? "Carrier",
                        })
                      }
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Quote
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Upload Quote Dialog */}
      <Dialog open={!!uploadDialog} onOpenChange={(open) => !open && setUploadDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Quote — {uploadDialog?.carrierName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="premium" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Total Premium
              </Label>
              <Input
                id="premium"
                type="number"
                placeholder="e.g. 12500"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-file">Quote Document (optional)</Label>
              <Input
                id="quote-file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setQuoteFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadDialog(null)}>Cancel</Button>
            <Button onClick={handleUploadQuote} disabled={!premiumAmount || uploading}>
              {uploading ? "Uploading..." : "Save Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Additional Info Request Dialog */}
      <Dialog open={!!infoRequestDialog} onOpenChange={(open) => !open && setInfoRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Additional Info Required — {infoRequestDialog?.carrierName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Please describe the information the carrier is requesting. The client will be notified via email and in-app notification.
            </p>
            <div className="space-y-2">
              <Label htmlFor="info-details">What information is needed?</Label>
              <Textarea
                id="info-details"
                placeholder="e.g. Updated loss runs for the past 3 years, current driver MVRs..."
                value={infoRequestDetails}
                onChange={(e) => setInfoRequestDetails(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInfoRequestDialog(null)}>Cancel</Button>
            <Button
              onClick={handleSubmitInfoRequest}
              disabled={!infoRequestDetails.trim() || submittingInfoRequest}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submittingInfoRequest ? "Sending..." : "Send Request & Notify Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubmittedMarkets;
