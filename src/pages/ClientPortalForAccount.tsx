import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const getCarrierLogoUrl = (logoPath: string | null) => {
  if (!logoPath) return null;
  const { data } = supabase.storage.from("carrier-logos").getPublicUrl(logoPath);
  return data?.publicUrl || null;
};

const CarrierAvatar = ({ carrier, fallbackClass }: { carrier: any; fallbackClass?: string }) => {
  const logoUrl = getCarrierLogoUrl(carrier?.logo_path);
  if (logoUrl) {
    return (
      <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-border">
        <img src={logoUrl} alt={carrier?.name || "Carrier"} className="h-6 w-6 object-contain" />
      </div>
    );
  }
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${fallbackClass || "bg-primary/10"}`}>
      <Building className="h-4 w-4 text-primary" />
    </div>
  );
};
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, Truck, Shield, Clock, CheckCircle2,
  ChevronRight, ClipboardList, MapPin, Users, Package, Building, AlertCircle, AlertTriangle,
} from "lucide-react";
import ApplicationWizard from "@/components/application/ApplicationWizard";
import DocumentHub from "@/components/staff/DocumentHub";

import { WIZARD_STEPS } from "@/components/application/constants";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_info: { label: "Pending Information", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  info_complete: { label: "Info Complete", color: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
  quoting: { label: "Quoting in Progress", color: "bg-accent/10 text-accent border-accent/30", icon: FileText },
  quoted: { label: "Quotes Available", color: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  bound: { label: "Policy Bound", color: "bg-success/20 text-success border-success/40", icon: Shield },
  lead: { label: "New Lead", color: "bg-muted text-muted-foreground border-border", icon: Clock },
  declined: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
};

const quoteStatusConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary border-primary/20" },
  reviewing: { label: "Under Review", color: "bg-warning/10 text-warning border-warning/20" },
  info_requested: { label: "Additional Info Needed", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  quoted: { label: "Quoted", color: "bg-success/10 text-success border-success/20" },
  bound: { label: "Bound", color: "bg-success/20 text-success border-success/30" },
  declined: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface Props {
  accountId: string;
}

const ClientPortalForAccount = ({ accountId }: Props) => {
  const [showWizard, setShowWizard] = useState(false);
  const [showInfoRequestDialog, setShowInfoRequestDialog] = useState(false);

  const { data: account, isLoading } = useQuery({
    queryKey: ["account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: allQuotes } = useQuery({
    queryKey: ["client-all-quotes", accountId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*, carriers(name, logo_path)").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingInfoRequests } = useQuery({
    queryKey: ["info-requests", accountId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("info_requests")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
  });

  // Show info request dialog on mount when pending requests exist
  useEffect(() => {
    if (pendingInfoRequests && pendingInfoRequests.length > 0) {
      setShowInfoRequestDialog(true);
    }
  }, [pendingInfoRequests]);

  const reviewingQuotes = allQuotes?.filter((q: any) => ["submitted", "reviewing"].includes(q.status)) ?? [];
  const actionNeededQuotes = allQuotes?.filter((q: any) => q.status === "info_requested") ?? [];
  const completedQuotes = allQuotes?.filter((q: any) => ["quoted", "bound"].includes(q.status)) ?? [];

  const { data: powerUnits } = useQuery({
    queryKey: ["client-power-units", accountId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("power_units").select("id").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["client-drivers", accountId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("id").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !account) {
    return (
      <div className="flex items-center justify-center py-20">
        <Truck className="h-6 w-6 text-primary animate-pulse mr-3" />
        <span className="text-muted-foreground font-mono text-sm">Loading account...</span>
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="gap-1.5 text-muted-foreground">
          ← Back to Dashboard
        </Button>
        <ApplicationWizard account={account} onSubmitComplete={() => setShowWizard(false)} />
      </div>
    );
  }

  const appStep = account.application_step || 1;
  const appProgress = Math.round((appStep / WIZARD_STEPS.length) * 100);
  const currentStepName = WIZARD_STEPS.find((s) => s.id === appStep)?.title ?? "Getting Started";
  const isComplete = ["info_complete", "quoting", "quoted", "bound"].includes(account.status);
  const statusInfo = statusConfig[account.status] ?? statusConfig.lead;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Staff preview banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-3">
          <Truck className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong>Staff Preview</strong> — Viewing client portal for <strong>{account.company_name}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{account.company_name}</h1>
          {account.dba_name && <p className="text-sm text-muted-foreground font-mono">DBA: {account.dba_name}</p>}
        </div>
        <Badge variant="outline" className={`${statusInfo.color} gap-1.5 text-sm px-3 py-1.5`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "DOT Number", value: account.dot_number || "—", icon: Truck },
          { label: "Fleet Size", value: powerUnits?.length ?? account.fleet_size ?? "—", icon: Package },
          { label: "Drivers", value: drivers?.length ?? account.total_drivers ?? "—", icon: Users },
          { label: "Operating States", value: account.operating_states?.length ?? "—", icon: MapPin },
        ].map((stat) => (
          <Card key={stat.label} className="glass-panel">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-primary opacity-70" />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Application Progress */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Application Progress</CardTitle>
            </div>
            <span className="text-sm font-bold text-primary">{appProgress}%</span>
          </div>
          <CardDescription className="text-xs">
            {isComplete ? "Application submitted and under review." : `Currently on: ${currentStepName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={appProgress} className="h-2" />
          <div className="flex flex-wrap gap-1.5">
            {WIZARD_STEPS.map((step) => (
              <span
                key={step.id}
                className={`text-[10px] font-mono px-2 py-1 rounded border ${
                  step.id < appStep
                    ? "bg-success/10 text-success border-success/20"
                    : step.id === appStep
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {step.id < appStep ? "✓" : step.id} {step.shortTitle}
              </span>
            ))}
          </div>
          <Button onClick={() => setShowWizard(true)} className="w-full sm:w-auto gap-2">
            {appStep > 1 ? "Continue Application" : "View Application"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Action Needed */}
      {actionNeededQuotes.length > 0 && (
        <Card className="glass-panel border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-amber-600">Action Needed</CardTitle>
            </div>
            <CardDescription className="text-xs">These carriers have requested additional information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {actionNeededQuotes.map((q: any) => {
                const infoReq = pendingInfoRequests?.find((ir: any) => ir.quote_id === q.id);
                return (
                  <div key={q.id} className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <CarrierAvatar carrier={q.carriers} fallbackClass="bg-amber-500/20" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                      {infoReq ? (
                        <p className="text-xs text-amber-700 mt-1">{infoReq.request_details}</p>
                      ) : (
                        <p className="text-[11px] text-amber-600 font-mono">Additional info requested</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Carriers Reviewing */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Carriers Reviewing</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {reviewingQuotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reviewingQuotes.map((q: any) => {
                const cfg = quoteStatusConfig[q.status] ?? quoteStatusConfig.submitted;
                return (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border">
                    <CarrierAvatar carrier={q.carriers} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{q.carriers?.name ?? "Carrier"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{cfg.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No carriers reviewing yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Quotes */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Your Quotes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {completedQuotes.length > 0 ? (
            <div className="space-y-3">
              {completedQuotes.map((q: any) => {
                const cfg = quoteStatusConfig[q.status] ?? quoteStatusConfig.quoted;
                return (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-md bg-secondary/50 border border-border gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <CarrierAvatar carrier={q.carriers} />
                      <p className="font-semibold truncate">{q.carriers?.name ?? "Carrier"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {q.premium_estimate ? (
                        <span className="text-lg font-bold text-foreground">${Number(q.premium_estimate).toLocaleString()}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Pending</span>
                      )}
                      {(q.coverage_details as any)?.quote_file_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={async () => {
                            const path = (q.coverage_details as any).quote_file_path;
                            let { data } = await supabase.storage.from("loss-runs").createSignedUrl(path, 3600);
                            if (!data?.signedUrl) {
                              ({ data } = await supabase.storage.from("account-documents").createSignedUrl(path, 3600));
                            }
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Download Quote
                        </Button>
                      )}
                      {(q.coverage_details as any)?.binder_file_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={async () => {
                            const path = (q.coverage_details as any).binder_file_path;
                            let { data } = await supabase.storage.from("loss-runs").createSignedUrl(path, 3600);
                            if (!data?.signedUrl) {
                              ({ data } = await supabase.storage.from("account-documents").createSignedUrl(path, 3600));
                            }
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Download Policy
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No quotes available yet.</p>
          )}
        </CardContent>
      </Card>
      {/* Documents */}
      <DocumentHub accountId={accountId} readOnly={false} />

      {/* Pending Info Requests Popup */}
      <Dialog open={showInfoRequestDialog} onOpenChange={setShowInfoRequestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Action Required — Additional Information Needed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              The following carriers need more information before they can provide a quote. Please review and provide the requested details.
            </p>
            {pendingInfoRequests?.map((ir: any) => (
              <div key={ir.id} className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                <p className="font-semibold text-sm">{ir.carrier_name}</p>
                <p className="text-sm text-foreground">{ir.request_details}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Requested {new Date(ir.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoRequestDialog(false)}>
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortalForAccount;
