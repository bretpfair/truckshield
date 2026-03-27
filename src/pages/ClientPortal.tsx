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
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle, FileText, Truck, Shield, Clock, CheckCircle2,
  ChevronRight, ClipboardList, MapPin, Users, Package, Building, AlertTriangle,
} from "lucide-react";
import ApplicationWizard from "@/components/application/ApplicationWizard";

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
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="gap-1.5 text-muted-foreground">
          ← Back to Dashboard
        </Button>
        <ApplicationWizard account={account} />
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
            {isComplete ? "Your application has been submitted and is being reviewed." : `Currently on: ${currentStepName}`}
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
          {!isComplete && (
            <Button onClick={() => setShowWizard(true)} className="w-full sm:w-auto gap-2">
              {appStep > 1 ? "Continue Application" : "Start Application"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
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
              {actionNeededQuotes.map((q: any) => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                    <p className="text-[11px] text-amber-600 font-mono">Additional info requested</p>
                  </div>
                </div>
              ))}
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
          <CardDescription className="text-xs">Your application is being marketed to these carriers</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewingQuotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reviewingQuotes.map((q: any) => {
                const cfg = quoteStatusConfig[q.status] ?? quoteStatusConfig.submitted;
                return (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{q.carriers?.name ?? "Carrier"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{cfg.label}</p>
                    </div>
                    <span className="relative flex h-2.5 w-2.5">
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

      {/* Quotes Section */}
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
                  <div key={q.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/50 border border-border">
                    <div>
                      <p className="font-semibold text-foreground">{q.carriers?.name ?? "Carrier"}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground font-mono mt-1">
                        {q.premium_estimate && <span>Premium: ${Number(q.premium_estimate).toLocaleString()}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isComplete ? "Your application is under review. Quotes will appear here once available." : "Complete your application to receive quotes from carriers."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default ClientPortal;
