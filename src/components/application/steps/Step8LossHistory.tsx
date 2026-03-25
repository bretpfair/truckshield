import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CANCELLATION_REASONS, MONTHS } from "../constants";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const COVERAGE_TYPES = ["Auto Liability", "Physical Damage", "Cargo Liability"];

const emptyTerm = { from_month: "", from_year: "", to_month: "", to_year: "", num_claims: 0, power_units: "", insurance_company: "", claims: [] as any[] };

const Step8LossHistory = ({ account }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [histories, setHistories] = useState<any[]>([]);

  const { data } = useQuery({
    queryKey: ["loss-history", account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loss_history")
        .select("*")
        .eq("account_id", account.id);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      if (data.length) {
        setHistories(data);
      } else {
        setHistories(COVERAGE_TYPES.map((ct) => ({
          account_id: account.id,
          coverage_type: ct,
          no_prior_coverage: false,
          policy_terms: [{ ...emptyTerm }],
          cancelled_nonrenewed: false,
          cancellation_reason: "",
          cancellation_reason_other: "",
        })));
      }
    }
  }, [data, account.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("loss_history").delete().eq("account_id", account.id);
      const toInsert = histories.map((h) => ({
        ...h,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error } = await supabase.from("loss_history").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loss-history"] });
      toast({ title: "Loss history saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateHistory = (idx: number, field: string, value: any) => {
    const updated = [...histories];
    updated[idx] = { ...updated[idx], [field]: value };
    setHistories(updated);
  };

  const updateTerm = (hIdx: number, tIdx: number, field: string, value: any) => {
    const updated = [...histories];
    const terms = [...(updated[hIdx].policy_terms || [])];
    terms[tIdx] = { ...terms[tIdx], [field]: value };
    updated[hIdx] = { ...updated[hIdx], policy_terms: terms };
    setHistories(updated);
  };

  const addTerm = (hIdx: number) => {
    const updated = [...histories];
    updated[hIdx] = { ...updated[hIdx], policy_terms: [...(updated[hIdx].policy_terms || []), { ...emptyTerm }] };
    setHistories(updated);
  };

  const removeTerm = (hIdx: number, tIdx: number) => {
    const updated = [...histories];
    updated[hIdx] = { ...updated[hIdx], policy_terms: updated[hIdx].policy_terms.filter((_: any, i: number) => i !== tIdx) };
    setHistories(updated);
  };

  const years = Array.from({ length: 7 }, (_, i) => (2020 + i).toString());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 8 — Loss History</h3>
        <p className="text-sm text-muted-foreground font-mono">Prior coverage and claims for each line</p>
      </div>

      {histories.map((hist, hIdx) => (
        <div key={hist.coverage_type} className="p-4 rounded-md bg-secondary/30 border border-border space-y-4">
          <h4 className="font-medium text-sm font-mono text-primary">{hist.coverage_type} Losses</h4>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hist.no_prior_coverage}
              onCheckedChange={(c) => updateHistory(hIdx, "no_prior_coverage", c)}
            />
            No prior coverage for this line
          </label>

          {!hist.no_prior_coverage && (
            <>
              {(hist.policy_terms || []).map((term: any, tIdx: number) => (
                <div key={tIdx} className="p-3 rounded bg-background/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">Policy Term {tIdx + 1}</span>
                    {(hist.policy_terms || []).length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeTerm(hIdx, tIdx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">From Month</Label>
                      <Select value={term.from_month || ""} onValueChange={(v) => updateTerm(hIdx, tIdx, "from_month", v)}>
                        <SelectTrigger><SelectValue placeholder="Mo" /></SelectTrigger>
                        <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">From Year</Label>
                      <Select value={term.from_year || ""} onValueChange={(v) => updateTerm(hIdx, tIdx, "from_year", v)}>
                        <SelectTrigger><SelectValue placeholder="Yr" /></SelectTrigger>
                        <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Month</Label>
                      <Select value={term.to_month || ""} onValueChange={(v) => updateTerm(hIdx, tIdx, "to_month", v)}>
                        <SelectTrigger><SelectValue placeholder="Mo" /></SelectTrigger>
                        <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Year</Label>
                      <Select value={term.to_year || ""} onValueChange={(v) => updateTerm(hIdx, tIdx, "to_year", v)}>
                        <SelectTrigger><SelectValue placeholder="Yr" /></SelectTrigger>
                        <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Number of Claims</Label>
                      <Input type="number" value={term.num_claims || 0} onChange={(e) => updateTerm(hIdx, tIdx, "num_claims", parseInt(e.target.value) || 0)} min={0} max={10} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Power Units</Label>
                      <Input type="number" value={term.power_units || ""} onChange={(e) => updateTerm(hIdx, tIdx, "power_units", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Insurance Company</Label>
                      <Input value={term.insurance_company || ""} onChange={(e) => updateTerm(hIdx, tIdx, "insurance_company", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addTerm(hIdx)} className="gap-1">
                <Plus className="h-3 w-3" /> Add Policy Term
              </Button>
            </>
          )}

          {/* Cancellation */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hist.cancelled_nonrenewed}
                onCheckedChange={(c) => updateHistory(hIdx, "cancelled_nonrenewed", c)}
              />
              Cancelled or Non-Renewed?
            </label>
            {hist.cancelled_nonrenewed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <Select value={hist.cancellation_reason || ""} onValueChange={(v) => updateHistory(hIdx, "cancellation_reason", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{CANCELLATION_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {hist.cancellation_reason === "Other" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Explain</Label>
                    <Input value={hist.cancellation_reason_other || ""} onChange={(e) => updateHistory(hIdx, "cancellation_reason_other", e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <Button onClick={() => saveMutation.mutate()} className="w-full">Save Loss History</Button>
    </div>
  );
};

export default Step8LossHistory;
