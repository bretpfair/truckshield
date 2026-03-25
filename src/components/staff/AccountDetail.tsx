import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Zap, Send } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Props {
  accountId: string;
  onBack: () => void;
}

interface CarrierRow {
  id: string;
  name: string;
  am_best_rating: string | null;
  appetite_guide: Json | null;
  preferred_cargo_types: string[] | null;
  preferred_states: string[] | null;
  min_fleet_size: number | null;
  max_fleet_size: number | null;
  max_claims_tolerance: number | null;
  is_active: boolean;
}

const calculateScore = (account: any, carrier: CarrierRow): number => {
  let score = 0;
  let factors = 0;

  // Cargo match
  if (account.cargo_types?.length && carrier.preferred_cargo_types?.length) {
    factors++;
    const overlap = account.cargo_types.filter((c: string) =>
      carrier.preferred_cargo_types!.includes(c)
    ).length;
    score += (overlap / Math.max(account.cargo_types.length, 1)) * 100;
  }

  // State match
  if (account.operating_states?.length && carrier.preferred_states?.length) {
    factors++;
    const overlap = account.operating_states.filter((s: string) =>
      carrier.preferred_states!.includes(s)
    ).length;
    score += (overlap / Math.max(account.operating_states.length, 1)) * 100;
  }

  // Fleet size
  if (account.fleet_size && carrier.min_fleet_size != null && carrier.max_fleet_size != null) {
    factors++;
    if (account.fleet_size >= carrier.min_fleet_size && account.fleet_size <= carrier.max_fleet_size) {
      score += 100;
    }
  }

  // Claims
  if (account.number_of_claims != null && carrier.max_claims_tolerance != null) {
    factors++;
    if (account.number_of_claims <= carrier.max_claims_tolerance) {
      score += 100;
    }
  }

  return factors > 0 ? Math.round(score / factors) : 0;
};

const AccountDetail = ({ accountId, onBack }: Props) => {
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
      return data as CarrierRow[];
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

  const createQuote = useMutation({
    mutationFn: async ({ carrierId, score }: { carrierId: string; score: number }) => {
      const { error } = await supabase.from("quotes").insert({
        account_id: accountId,
        carrier_id: carrierId,
        match_score: score,
        status: "draft",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      toast({ title: "Quote created" });
    },
  });

  const publishQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      toast({ title: "Quote published to client" });
    },
  });

  const rankedCarriers = carriers
    ?.map((c) => ({ ...c, score: calculateScore(account, c) }))
    .sort((a, b) => b.score - a.score);

  if (!account) return null;

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
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">{account.company_name}</h2>
        <Badge variant="outline">{account.status.replace(/_/g, " ")}</Badge>
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

      {/* Carrier Matching */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Carrier Matching
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankedCarriers?.length ? (
            <div className="space-y-2">
              {rankedCarriers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 text-center">
                      <span className={`text-lg font-bold font-mono ${c.score >= 70 ? "text-success" : c.score >= 40 ? "text-warning" : "text-destructive"}`}>
                        {c.score}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {c.am_best_rating && `AM Best: ${c.am_best_rating}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createQuote.mutate({ carrierId: c.id, score: c.score })}
                  >
                    Generate Quote
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No carriers in the system yet. Add carriers in the Carriers tab.</p>
          )}
        </CardContent>
      </Card>

      {/* Existing Quotes */}
      {existingQuotes && existingQuotes.length > 0 && (
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingQuotes.map((q: any) => (
              <div key={q.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                <div>
                  <p className="font-medium">{q.carriers?.name ?? "Unknown Carrier"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span>Score: {q.match_score}</span>
                    {q.premium_estimate && <span>Premium: ${Number(q.premium_estimate).toLocaleString()}</span>}
                    <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                  </div>
                </div>
                {q.status === "draft" && (
                  <Button size="sm" onClick={() => publishQuote.mutate(q.id)}>
                    <Send className="h-3 w-3 mr-1" /> Publish
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AccountDetail;
