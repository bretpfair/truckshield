import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, RefreshCw, FileText, ExternalLink, DollarSign, Shield } from "lucide-react";

interface CWSubmission {
  id: string;
  submission_number: string;
  status: string;
  quote_pdf_url: string | null;
  coverages_data: any;
  total_premium: number | null;
  created_at: string;
}

interface Props {
  accountId: string;
  companyName?: string;
}

const coverageLabels: Record<string, string> = {
  al: "Auto Liability",
  apd: "Auto Physical Damage",
  mtc: "Motor Truck Cargo",
  tgl: "Truckers General Liability",
  ntl: "Non-Trucking Liability",
};

const CoverWhaleActions = ({ accountId, companyName }: Props) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<any>(null);
  const [bindDialog, setBindDialog] = useState<CWSubmission | null>(null);
  const [bindEffectiveDate, setBindEffectiveDate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({
    queryKey: ["coverwhale_submissions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coverwhale_submissions" as any)
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CWSubmission[];
    },
  });

  const callCW = async (action: string, extra?: any) => {
    setLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("coverwhale-api", {
        body: { action, accountId, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));

      queryClient.invalidateQueries({ queryKey: ["coverwhale_submissions", accountId] });
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      queryClient.invalidateQueries({ queryKey: ["activity_log", accountId] });

      if (action === "quote" || action === "indication") {
        setResultDialog(data);
        toast({
          title: `Cover Whale ${action === "quote" ? "Quote" : "Indication"} Received`,
          description: data.submission_number ? `Submission #${data.submission_number}` : "Check results below",
        });
      } else if (action === "submission-status") {
        toast({ title: "Status Updated", description: `Current status: ${data.status || data.submission_status || "unknown"}` });
      } else if (action === "bind") {
        toast({ title: "Bind Requested", description: `Submission #${extra.submissionNumber}` });
        setBindDialog(null);
      }
    } catch (err: any) {
      console.error("CW error:", err);
      let msg = err.message || "Request failed";
      if (typeof err === "object" && err.errors) {
        msg = Object.entries(err.errors).map(([k, v]) => `${k}: ${v}`).join("; ");
      }
      toast({ title: "Cover Whale Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleBind = () => {
    if (!bindDialog || !bindEffectiveDate) return;
    const [y, m, d] = bindEffectiveDate.split("-");
    const formattedDate = `${m}/${d}/${y}`;

    callCW("bind", {
      submissionNumber: bindDialog.submission_number,
      bindData: {
        coverage: {
          includeAL: bindDialog.coverages_data?.al ? "Y" : "N",
          brokerFeeAL: 0,
          includeAPD: bindDialog.coverages_data?.apd ? "Y" : "N",
          brokerFeeAPD: 0,
          includeMTC: bindDialog.coverages_data?.mtc ? "Y" : "N",
          brokerFeeMTC: 0,
          includeTGL: bindDialog.coverages_data?.tgl ? "Y" : "N",
          brokerFeeTGL: 0,
          includeNTL: bindDialog.coverages_data?.ntl ? "Y" : "N",
          brokerFeeNTL: 0,
          electTRIA: "N",
          optInCWFinancing: "Y",
          effectiveDate: formattedDate,
        },
      },
    });
  };

  const latestSub = submissions?.[0];

  return (
    <>
      <Card className="glass-panel border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Cover Whale Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => callCW("indication")}
              disabled={!!loading}
            >
              {loading === "indication" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Get Indication
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => callCW("quote")}
              disabled={!!loading}
            >
              {loading === "quote" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
              Get Full Quote
            </Button>
            {latestSub && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => callCW("submission-status", { submissionNumber: latestSub.submission_number })}
                disabled={!!loading}
              >
                {loading === "submission-status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Check Status
              </Button>
            )}
          </div>

          {submissions && submissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Submissions</p>
              {submissions.map((sub) => (
                <div key={sub.id} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold font-mono">#{sub.submission_number}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {sub.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {sub.quote_pdf_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 gap-1"
                          onClick={() => window.open(sub.quote_pdf_url!, "_blank")}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="text-xs">PDF</span>
                        </Button>
                      )}
                      {sub.status?.toLowerCase() === "quoted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 gap-1 text-xs"
                          onClick={() => {
                            setBindDialog(sub);
                            setBindEffectiveDate("");
                          }}
                        >
                          Bind
                        </Button>
                      )}
                    </div>
                  </div>

                  {sub.total_premium != null && (
                    <p className="text-sm font-semibold text-success">
                      Total: ${Number(sub.total_premium).toLocaleString()}
                    </p>
                  )}

                  {sub.coverages_data && Object.keys(sub.coverages_data).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(sub.coverages_data).filter(([, cov]) => cov != null).map(([key, cov]: [string, any]) => (
                        <div key={key} className="text-xs space-y-0.5">
                          <p className="font-mono text-muted-foreground uppercase">{coverageLabels[key] || key}</p>
                          <p className="font-semibold">${Number(cov?.totalCost || cov?.premium || 0).toLocaleString()}</p>
                          {cov?.limit > 0 && <p className="text-muted-foreground">Limit: ${Number(cov.limit).toLocaleString()}</p>}
                          {cov?.deductible > 0 && <p className="text-muted-foreground">Ded: ${Number(cov.deductible).toLocaleString()}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resultDialog} onOpenChange={(open) => !open && setResultDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Cover Whale Result
            </DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{resultDialog.status}</Badge>
              </div>
              {resultDialog.submission_number && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Submission #</span>
                  <span className="font-mono font-semibold">{resultDialog.submission_number}</span>
                </div>
              )}
              {resultDialog.coverages && (
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase text-muted-foreground">Coverage Breakdown</p>
                  {Object.entries(resultDialog.coverages).filter(([, cov]) => cov != null).map(([key, cov]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span>{coverageLabels[key] || key}</span>
                      <div className="text-right">
                        <p className="font-semibold">${Number(cov?.totalCost || cov?.premium || 0).toLocaleString()}</p>
                        {cov?.limit > 0 && <p className="text-xs text-muted-foreground">Limit: ${Number(cov.limit).toLocaleString()}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between font-semibold text-success border-t pt-2">
                    <span>Total</span>
                    <span>
                      ${Object.values(resultDialog.coverages)
                        .reduce((sum: number, c: any) => sum + (c?.totalCost || 0), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {resultDialog.quote_pdf && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(resultDialog.quote_pdf, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" /> View Quote PDF
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResultDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bindDialog} onOpenChange={(open) => !open && setBindDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Bind — Submission #{bindDialog?.submission_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will initiate the binding process with Cover Whale. The submission will be updated to "Pending Signatures."
            </p>
            {bindDialog?.total_premium && (
              <div className="flex items-center justify-between text-sm">
                <span>Total Premium</span>
                <span className="font-semibold text-success">${Number(bindDialog.total_premium).toLocaleString()}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="bind-date">Effective Date</Label>
              <Input
                id="bind-date"
                type="date"
                value={bindEffectiveDate}
                onChange={(e) => setBindEffectiveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBindDialog(null)}>Cancel</Button>
            <Button onClick={handleBind} disabled={!bindEffectiveDate || !!loading}>
              {loading === "bind" ? "Binding..." : "Initiate Bind"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoverWhaleActions;
