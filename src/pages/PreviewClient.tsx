import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, FileText, Truck, Shield, Clock, CheckCircle2,
  ChevronRight, ClipboardList, MapPin, Users, Package, Building,
} from "lucide-react";
import { WIZARD_STEPS } from "@/components/application/constants";
import ApplicationWizard from "@/components/application/ApplicationWizard";

const MOCK_ACCOUNT = {
  id: "preview-mock-id",
  company_name: "Ekall's Express LLC",
  dba_name: "Ekall's Trucking",
  status: "pending_info",
  application_step: 4,
  dot_number: "4217593",
  mc_number: "MC-1284710",
  ein_tax_id: "93-3218847",
  business_type: "Corporation/LLC",
  business_owner_name: "James Ekall",
  business_owner_dob: "1982-06-15",
  mailing_address: "1420 Industrial Pkwy",
  mailing_city: "Portland",
  mailing_state: "OR",
  mailing_zip: "97201",
  county: "Multnomah",
  carrier_authority_prefix: "MC",
  carrier_authority_number: "1284710",
  date_of_authority: "2021-03-10",
  years_in_business: 4,
  fleet_size: 8,
  total_trucks: 8,
  total_drivers: 10,
  annual_revenue: 1850000,
  operating_states: ["OR", "WA", "CA", "ID", "NV"],
  cargo_types: ["Dry Van/Box", "Refrigerated", "Flatbed"],
  business_categories: ["Dry Van/Box", "Refrigerated"],
  contractor_types: null,
  coverage_selections: {
    bipd_limit: "$1,000,000",
    cargo_limit: "$100K",
    gl_option: "$1M/$2M",
    deductible: "$2,500",
  },
  radius_operations: [
    { range: "0 – 100 miles", percentage: 30 },
    { range: "100 – 500 miles", percentage: 50 },
    { range: "500 – 1,000 miles", percentage: 20 },
  ],
  commodity_info: {},
  general_questions: {},
  requested_effective_date: "2026-05-01",
  current_coverage_expiry: "2026-04-30",
  total_owned_trailers: 6,
  total_nonowned_trailers: 2,
  total_garage_locations: 2,
  total_subhaul_revenue: null,
  total_annual_revenue: 1850000,
  projected_gross_receipts: 2100000,
  loss_history_summary: "",
  number_of_claims: 1,
  notes: "",
  client_user_id: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_QUOTES = [
  {
    id: "q1",
    carriers: { name: "Great West Casualty" },
    premium_estimate: 42500,
    published_at: "2026-03-20T00:00:00Z",
    expires_at: "2026-04-20T00:00:00Z",
  },
  {
    id: "q2",
    carriers: { name: "Canal Insurance" },
    premium_estimate: 38900,
    published_at: "2026-03-22T00:00:00Z",
    expires_at: "2026-04-22T00:00:00Z",
  },
];

const MOCK_REVIEWING_CARRIERS = [
  { id: "r1", carriers: { name: "Progressive Commercial" } },
  { id: "r2", carriers: { name: "Sentry Insurance" } },
  { id: "r3", carriers: { name: "National Interstate" } },
  { id: "r4", carriers: { name: "Northland Insurance" } },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_info: { label: "Pending Information", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  info_complete: { label: "Info Complete", color: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
  quoting: { label: "Quoting in Progress", color: "bg-accent/10 text-accent border-accent/30", icon: FileText },
  quoted: { label: "Quotes Available", color: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  bound: { label: "Policy Bound", color: "bg-success/20 text-success border-success/40", icon: Shield },
};

const PreviewClient = () => {
  const [showWizard, setShowWizard] = useState(false);

  const account = MOCK_ACCOUNT;
  const appStep = account.application_step;
  const appProgress = Math.round((appStep / WIZARD_STEPS.length) * 100);
  const currentStepName = WIZARD_STEPS.find((s) => s.id === appStep)?.title ?? "Getting Started";
  const isComplete = ["info_complete", "quoting", "quoted", "bound"].includes(account.status);
  const statusInfo = statusConfig[account.status] ?? statusConfig.pending_info;
  const StatusIcon = statusInfo.icon;

  if (showWizard) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">TruckShield</span>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Preview</Badge>
            </div>
          </div>
        </header>
        <main className="container px-4 py-6 max-w-4xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="gap-1.5 text-muted-foreground">
            ← Back to Dashboard
          </Button>
          <ApplicationWizard account={account} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TruckShield</span>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Preview</Badge>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Preview banner */}
        <div className="max-w-5xl mx-auto mb-6">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong>Preview Mode</strong> — This is a read-only demo of the client dashboard with sample data.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{account.company_name}</h1>
              {account.dba_name && (
                <p className="text-sm text-muted-foreground font-mono">DBA: {account.dba_name}</p>
              )}
            </div>
            <Badge variant="outline" className={`${statusInfo.color} gap-1.5 text-sm px-3 py-1.5`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusInfo.label}
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "DOT Number", value: account.dot_number, icon: Truck },
              { label: "Fleet Size", value: `${account.fleet_size} trucks`, icon: Package },
              { label: "Drivers", value: account.total_drivers, icon: Users },
              { label: "Operating States", value: `${account.operating_states.length} states`, icon: MapPin },
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
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    Application Progress
                  </CardTitle>
                </div>
                <span className="text-sm font-bold text-primary">{appProgress}%</span>
              </div>
              <CardDescription className="text-xs">
                Currently on: {currentStepName}
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
                  Continue Application
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Carriers Reviewing */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Carriers Reviewing
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Your application is being marketed to these carriers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOCK_REVIEWING_CARRIERS.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{q.carriers.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">Under review</p>
                    </div>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quotes Section */}
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Your Quotes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_QUOTES.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-4 rounded-md bg-secondary/50 border border-border"
                >
                  <div>
                    <p className="font-semibold text-foreground">{q.carriers.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground font-mono mt-1">
                      <span>Premium: ${Number(q.premium_estimate).toLocaleString()}</span>
                      <span>Published: {new Date(q.published_at).toLocaleDateString()}</span>
                      <span>Expires: {new Date(q.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Available
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PreviewClient;
