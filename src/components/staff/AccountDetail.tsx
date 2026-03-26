import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, ClipboardList, Eye, Download } from "lucide-react";
import { generateApplicationPdf } from "@/lib/generateApplicationPdf";
import MarketGuidance from "./MarketGuidance";
import SubmittedMarkets from "./SubmittedMarkets";
import ApplicationWizard from "@/components/application/ApplicationWizard";

interface Props {
  accountId: string;
  onBack: () => void;
  onPreviewClient?: (accountId: string) => void;
}

const AccountDetail = ({ accountId, onBack, onPreviewClient }: Props) => {
  const [showWizard, setShowWizard] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ["account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: carriers } = useQuery({
    queryKey: ["carriers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("carriers").select("*").eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: powerUnits } = useQuery({
    queryKey: ["power_units", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_units").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: accountTrailers } = useQuery({
    queryKey: ["trailers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trailers").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: lossHistory } = useQuery({
    queryKey: ["loss_history", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loss_history").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: garageLocations } = useQuery({
    queryKey: ["garage_locations", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_locations").select("*").eq("account_id", accountId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingQuotes } = useQuery({
    queryKey: ["quotes", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*, carriers(name)").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const markSubmitted = useMutation({
    mutationFn: async ({ carrierId, score }: { carrierId: string; score: number }) => {
      const { error } = await supabase.from("quotes").insert({
        account_id: accountId,
        carrier_id: carrierId,
        match_score: score,
        status: "submitted",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      toast({ title: "Marked as submitted" });
    },
  });

  const submittedCarrierIds = existingQuotes?.map((q: any) => q.carrier_id) || [];

  if (!account) return null;

  if (showWizard) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="gap-1.5 text-muted-foreground">
          ← Back to Account
        </Button>
        <ApplicationWizard account={account} />
      </div>
    );
  }

  const infoFields = [
    { label: "DOT#", value: account.dot_number },
    { label: "MC#", value: account.mc_number },
    { label: "Fleet Size", value: account.fleet_size },
    { label: "Years in Business", value: account.years_in_business },
    { label: "Annual Revenue", value: account.annual_revenue ? `$${Number(account.annual_revenue).toLocaleString()}` : null },
    { label: "Cargo Types", value: account.cargo_types?.join(", ") },
    { label: "Operating States", value: account.operating_states?.join(", ") },
    { label: "Claims", value: account.number_of_claims },
    { label: "Loss History", value: account.loss_history_summary },
    { label: "Coverage Expiry", value: account.current_coverage_expiry },
    { label: "Business Type", value: account.business_type },
    { label: "Authority Date", value: account.date_of_authority },
  ];

  // submittedCarrierIds moved above

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">{account.company_name}</h2>
        <Badge variant="outline">{account.status.replace(/_/g, " ")}</Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setShowWizard(true)} className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> View Application
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            generateApplicationPdf({
              account,
              drivers: drivers || [],
              powerUnits: powerUnits || [],
              trailers: accountTrailers || [],
              lossHistory: lossHistory || [],
              garageLocations: garageLocations || [],
            })
          }
        >
          <Download className="h-3.5 w-3.5" /> Download Application
        </Button>
        {onPreviewClient && (
          <Button variant="outline" size="sm" onClick={() => onPreviewClient(accountId)} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview Client
          </Button>
        )}
      </div>

      {/* Account Info */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {infoFields.map((f) => (
              <div key={f.label}>
                <p className="text-xs text-muted-foreground font-mono">{f.label}</p>
                <p className="text-sm font-medium">{f.value || <span className="text-muted-foreground italic">Missing</span>}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Guidance */}
      {carriers && (
        <MarketGuidance
          account={account}
          carriers={carriers}
          drivers={drivers || []}
          powerUnits={powerUnits || []}
          trailers={accountTrailers || []}
          lossHistory={lossHistory || []}
          onMarkSubmitted={(carrierId, score) => markSubmitted.mutate({ carrierId, score })}
          submittedCarrierIds={submittedCarrierIds}
        />
      )}

      {/* Submitted Markets */}
      {existingQuotes && existingQuotes.length > 0 && (
        <SubmittedMarkets accountId={accountId} quotes={existingQuotes} />
      )}
    </div>
  );
};

export default AccountDetail;
