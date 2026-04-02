import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle, FileText, Truck, Shield, Clock, CheckCircle2,
  ChevronRight, ClipboardList, MapPin, Users, Package, Building, AlertTriangle, Download,
} from "lucide-react";
import ApplicationWizard from "@/components/application/ApplicationWizard";
import DocumentHub from "@/components/staff/DocumentHub";
import InfoRequestBanner from "@/components/client/InfoRequestBanner";
import JourneyTimeline from "@/components/client/JourneyTimeline";
import PolicyRenewalCard from "@/components/client/PolicyRenewalCard";
import { WIZARD_STEPS } from "@/components/application/constants";

/* ── helpers ─────────────────────────────────────────── */

const getCarrierLogoUrl = (logoPath: string | null) => {
  if (!logoPath) return null;
  const { data } = supabase.storage.from("carrier-logos").getPublicUrl(logoPath);
  return data?.publicUrl || null;
};

const CarrierAvatar = ({ carrier, fallbackClass }: { carrier: any; fallbackClass?: string }) => {
  const logoUrl = getCarrierLogoUrl(carrier?.logo_path);
  if (logoUrl) {
    return (
      <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border">
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

/* ── config ──────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_info: { label: "Pending Information", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  info_complete: { label: "Info Complete", color: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
  quoting: { label: "Quoting in Progress", color: "bg-accent/10 text-accent border-accent/30", icon: FileText },
  quoted: { label: "Quotes Available", color: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  bound: { label: "Policy Bound", color: "bg-success/20 text-success border-success/40", icon: Shield },
  
  declined: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
};

const quoteStatusConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary border-primary/20" },
  reviewing: { label: "Under Review", color: "bg-warning/10 text-warning border-warning/20" },
  info_requested: { label: "Additional Info Needed", color: "bg-warning/10 text-warning border-warning/20" },
  quoted: { label: "Quoted", color: "bg-success/10 text-success border-success/20" },
  bound: { label: "Bound", color: "bg-success/20 text-success border-success/30" },
  declined: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

/* ── component ───────────────────────────────────────── */

interface ClientPortalProps {
  onSetMessagingAccount?: (accountId: string) => void;
}

const ClientPortal = ({ onSetMessagingAccount }: ClientPortalProps = {}) => {
  const { user } = useAuth();
  const [showWizard, setShowWizard] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const account = accounts?.[0];

  useEffect(() => {
    if (account?.id && onSetMessagingAccount) {
      onSetMessagingAccount(account.id);
    }
  }, [account?.id, onSetMessagingAccount]);

  const { data: allQuotes } = useQuery({
    queryKey: ["client-all-quotes", account?.id],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, carriers(name, logo_path)")
        .eq("account_id", account!.id);
      if (error) throw error;
      return data;
    },
  });

  const reviewingQuotes = allQuotes?.filter((q: any) => ["submitted", "reviewing"].includes(q.status)) ?? [];
  const actionNeededQuotes = allQuotes?.filter((q: any) => q.status === "info_requested") ?? [];
  const completedQuotes = allQuotes?.filter((q: any) => ["quoted", "bound"].includes(q.status)) ?? [];

  const { data: quoteDocuments } = useQuery({
    queryKey: ["client-quote-docs", account?.id],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_documents")
        .select("*")
        .eq("account_id", account!.id)
        .eq("category", "quotes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: powerUnits } = useQuery({
    queryKey: ["client-power-units", account?.id],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("power_units").select("id").eq("account_id", account!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["client-drivers", account?.id],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("id").eq("account_id", account!.id);
      if (error) throw error;
      return data;
    },
  });

  /* ── loading / empty states ─────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Truck className="h-6 w-6 text-primary animate-pulse mr-3" />
        <span className="text-muted-foreground font-mono text-sm">Loading your account...</span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Account Found</h2>
        <p className="text-muted-foreground">
          Your account hasn't been set up yet. Please contact your insurance representative
          to link your account to this portal.
        </p>
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in px-2 sm:px-0">
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
  const isBound = account.status === "bound";
  const statusInfo = statusConfig[account.status] ?? statusConfig.pending_info;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in px-1 sm:px-0">
      {/* ── Persistent Info Request Banner ── */}
      <InfoRequestBanner accountId={account.id} />

      {/* ── Welcome Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{account.company_name}</h1>
          {account.dba_name && <p className="text-sm text-muted-foreground font-mono truncate">DBA: {account.dba_name}</p>}
        </div>
        <Badge variant="outline" className={`${statusInfo.color} gap-1.5 text-sm px-3 py-1.5 self-start sm:self-auto shrink-0`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* ── Quick Stats (responsive grid) ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {[
          { label: "DOT Number", value: account.dot_number || "—", icon: Truck },
          { label: "Fleet Size", value: powerUnits?.length ?? account.fleet_size ?? "—", icon: Package },
          { label: "Drivers", value: drivers?.length ?? account.total_drivers ?? "—", icon: Users },
          { label: "Operating States", value: account.operating_states?.length ?? "—", icon: MapPin },
        ].map((stat) => (
          <Card key={stat.label} className="glass-panel">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary opacity-70 shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold text-foreground truncate">{stat.value}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono uppercase tracking-wider truncate">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Journey Timeline (replaces step chips when submitted) ── */}
      {isComplete && (
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Your Journey</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <JourneyTimeline accountStatus={account.status} />
          </CardContent>
        </Card>
      )}

      {/* ── View/Edit Application (post-submit) ── */}
      {isComplete && (
        <Card className="glass-panel">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Your Application</p>
                <p className="text-xs text-muted-foreground">View or update your submitted application details</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowWizard(true)} className="gap-1.5 shrink-0">
              <FileText className="h-3.5 w-3.5" />
              View Application
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Policy Renewal Tracking (bound only) ── */}
      {isBound && <PolicyRenewalCard currentCoverageExpiry={account.current_coverage_expiry} />}

      {/* ── Application Progress (pre-submit only) ── */}
      {!isComplete && (
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Application Progress</CardTitle>
              </div>
              <span className="text-sm font-bold text-primary">{appProgress}%</span>
            </div>
            <CardDescription className="text-xs">Currently on: {currentStepName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={appProgress} className="h-2" />
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {WIZARD_STEPS.map((step) => (
                <span
                  key={step.id}
                  className={`text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border ${
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
              {appStep > 1 ? "Continue Application" : "Start Application"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Action Needed ── */}
      {actionNeededQuotes.length > 0 && (
        <Card className="glass-panel border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-warning">Action Needed</CardTitle>
            </div>
            <CardDescription className="text-xs">These carriers have requested additional information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {actionNeededQuotes.map((q: any) => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-md bg-warning/10 border border-warning/20">
                  <CarrierAvatar carrier={q.carriers} fallbackClass="bg-warning/20" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                    <p className="text-[11px] text-warning font-mono">Additional info requested</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Carriers Reviewing ── */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Carriers Reviewing</CardTitle>
          </div>
          <CardDescription className="text-xs">Your application is being marketed to these carriers</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewingQuotes.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {reviewingQuotes.map((q: any) => {
                const cfg = quoteStatusConfig[q.status] ?? quoteStatusConfig.submitted;
                return (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border">
                    <CarrierAvatar carrier={q.carriers} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{cfg.label}</p>
                    </div>
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Building className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isComplete ? "Carriers will appear here once your application is being reviewed." : "Complete your application to begin the quoting process."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quotes ── */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Your Quotes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {completedQuotes.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {completedQuotes.map((q: any) => {
                const cfg = quoteStatusConfig[q.status] ?? quoteStatusConfig.quoted;
                return (
                  <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-md bg-secondary/50 border border-border gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <CarrierAvatar carrier={q.carriers} />
                      <p className="font-semibold text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
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
                            // Try loss-runs first, then account-documents
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
            <div className="text-center py-6 sm:py-8">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isComplete ? "Your application is under review. Quotes will appear here once available." : "Complete your application to receive quotes from carriers."}
              </p>
            </div>
          )}

          {/* Quote Documents */}
          {quoteDocuments && quoteDocuments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Quote Documents</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quoteDocuments.map((doc: any) => (
                  <Button
                    key={doc.id}
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 text-xs h-9"
                    onClick={async () => {
                      const { data } = await supabase.storage.from("account-documents").createSignedUrl(doc.file_path, 300);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{doc.file_name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Documents ── */}
      <DocumentHub accountId={account.id} readOnly={false} />
    </div>
  );
};

export default ClientPortal;
