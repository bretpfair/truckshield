import ApplicationWizard from "@/components/application/ApplicationWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Truck } from "lucide-react";

// Mock account for preview purposes
const MOCK_ACCOUNT = {
  id: "preview-mock-id",
  company_name: "Preview Trucking Co.",
  status: "new",
  application_step: 1,
  dot_number: "",
  mc_number: "",
  business_type: "",
  dba_name: "",
  ein_tax_id: "",
  mailing_address: "",
  mailing_city: "",
  mailing_state: "",
  mailing_zip: "",
  county: "",
  business_owner_name: "",
  business_owner_dob: "",
  carrier_authority_prefix: "",
  carrier_authority_number: "",
  date_of_authority: "",
  years_in_business: null,
  fleet_size: null,
  total_trucks: null,
  total_drivers: null,
  annual_revenue: null,
  coverage_selections: null,
  radius_operations: null,
  commodity_info: null,
  general_questions: null,
  operating_states: null,
  cargo_types: null,
  business_categories: null,
  contractor_types: null,
  requested_effective_date: "",
  current_coverage_expiry: "",
  total_owned_trailers: null,
  total_nonowned_trailers: null,
  total_garage_locations: null,
  total_subhaul_revenue: null,
  total_annual_revenue: null,
  projected_gross_receipts: null,
  loss_history_summary: "",
  number_of_claims: null,
  notes: "",
  client_user_id: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const PreviewClient = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TruckShield</span>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              Preview Mode
            </Badge>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-sm text-muted-foreground">
                This is a <strong>read-only preview</strong> of the client application wizard. Data will not be saved. Use this to review layout and flow.
              </p>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-xl font-bold">{MOCK_ACCOUNT.company_name}</h2>
            <p className="text-muted-foreground text-sm font-mono">Complete your application to receive quotes</p>
          </div>

          <ApplicationWizard account={MOCK_ACCOUNT} />
        </div>
      </main>
    </div>
  );
};

export default PreviewClient;
