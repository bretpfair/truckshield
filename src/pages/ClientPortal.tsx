import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

const CARGO_TYPES = [
  "General Freight", "Refrigerated", "Flatbed", "Tanker", "Hazmat",
  "Auto Hauler", "Intermodal", "Household Goods", "Livestock", "Oversized"
];

const ClientPortal = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: quotes } = useQuery({
    queryKey: ["client-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, carriers(name)")
        .eq("status", "published");
      if (error) throw error;
      return data;
    },
  });

  const account = accounts?.[0];

  if (isLoading) {
    return <p className="text-muted-foreground font-mono text-sm">Loading your account...</p>;
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">{account.company_name}</h2>
        <p className="text-muted-foreground text-sm font-mono">Complete your details to receive quotes</p>
      </div>

      <AccountForm account={account} />

      {/* Published Quotes */}
      {quotes && quotes.length > 0 && (
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Your Quotes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotes.map((q: any) => (
              <div key={q.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                <div>
                  <p className="font-medium">{q.carriers?.name ?? "Carrier"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground font-mono mt-1">
                    {q.premium_estimate && <span>Premium: ${Number(q.premium_estimate).toLocaleString()}</span>}
                    {q.published_at && <span>Published: {new Date(q.published_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success">Available</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const AccountForm = ({ account }: { account: any }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dot_number: account.dot_number ?? "",
    mc_number: account.mc_number ?? "",
    fleet_size: account.fleet_size?.toString() ?? "",
    years_in_business: account.years_in_business?.toString() ?? "",
    annual_revenue: account.annual_revenue?.toString() ?? "",
    cargo_types: account.cargo_types ?? [],
    operating_states: account.operating_states ?? [],
    loss_history_summary: account.loss_history_summary ?? "",
    number_of_claims: account.number_of_claims?.toString() ?? "0",
    current_coverage_expiry: account.current_coverage_expiry ?? "",
  });

  const updateAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("accounts")
        .update({
          dot_number: form.dot_number || null,
          mc_number: form.mc_number || null,
          fleet_size: form.fleet_size ? parseInt(form.fleet_size) : null,
          years_in_business: form.years_in_business ? parseInt(form.years_in_business) : null,
          annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
          cargo_types: form.cargo_types.length ? form.cargo_types : null,
          operating_states: form.operating_states.length ? form.operating_states : null,
          loss_history_summary: form.loss_history_summary || null,
          number_of_claims: form.number_of_claims ? parseInt(form.number_of_claims) : 0,
          current_coverage_expiry: form.current_coverage_expiry || null,
          status: "info_complete",
        })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-accounts"] });
      toast({ title: "Information saved", description: "Your details have been updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const completeness = [
    form.dot_number, form.fleet_size, form.cargo_types.length > 0,
    form.operating_states.length > 0, form.years_in_business,
  ].filter(Boolean).length;
  const total = 5;

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Account Information
          </CardTitle>
          <div className="flex items-center gap-2 text-xs font-mono">
            {completeness === total ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Clock className="h-4 w-4 text-warning" />
            )}
            <span className="text-muted-foreground">{completeness}/{total} complete</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${(completeness / total) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>DOT Number</Label>
            <Input value={form.dot_number} onChange={(e) => setForm({ ...form, dot_number: e.target.value })} placeholder="1234567" />
          </div>
          <div className="space-y-2">
            <Label>MC Number</Label>
            <Input value={form.mc_number} onChange={(e) => setForm({ ...form, mc_number: e.target.value })} placeholder="MC-123456" />
          </div>
          <div className="space-y-2">
            <Label>Fleet Size</Label>
            <Input type="number" value={form.fleet_size} onChange={(e) => setForm({ ...form, fleet_size: e.target.value })} placeholder="25" />
          </div>
          <div className="space-y-2">
            <Label>Years in Business</Label>
            <Input type="number" value={form.years_in_business} onChange={(e) => setForm({ ...form, years_in_business: e.target.value })} placeholder="10" />
          </div>
          <div className="space-y-2">
            <Label>Annual Revenue ($)</Label>
            <Input type="number" value={form.annual_revenue} onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })} placeholder="2500000" />
          </div>
          <div className="space-y-2">
            <Label>Number of Claims (last 3 years)</Label>
            <Input type="number" value={form.number_of_claims} onChange={(e) => setForm({ ...form, number_of_claims: e.target.value })} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Current Coverage Expiry</Label>
            <Input type="date" value={form.current_coverage_expiry} onChange={(e) => setForm({ ...form, current_coverage_expiry: e.target.value })} />
          </div>
        </div>

        {/* Cargo Types */}
        <div className="space-y-2">
          <Label>Cargo Types</Label>
          <div className="flex flex-wrap gap-2">
            {CARGO_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, cargo_types: toggleArrayItem(form.cargo_types, type) })}
                className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                  form.cargo_types.includes(type)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Operating States */}
        <div className="space-y-2">
          <Label>Operating States</Label>
          <div className="flex flex-wrap gap-1.5">
            {US_STATES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setForm({ ...form, operating_states: toggleArrayItem(form.operating_states, st) })}
                className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                  form.operating_states.includes(st)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Loss History */}
        <div className="space-y-2">
          <Label>Loss History Summary</Label>
          <Textarea
            value={form.loss_history_summary}
            onChange={(e) => setForm({ ...form, loss_history_summary: e.target.value })}
            placeholder="Describe your loss history over the past 3-5 years..."
            rows={3}
          />
        </div>

        <Button onClick={() => updateAccount.mutate()} className="w-full">
          Save Information
        </Button>
      </CardContent>
    </Card>
  );
};

export default ClientPortal;
