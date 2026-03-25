import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const COVERAGE_LINES = ["Auto Liability", "Physical Damage", "Cargo"];

const currentYear = new Date().getFullYear();
const YEAR_RANGES = [
  { label: `${currentYear - 1} – ${currentYear}`, from: currentYear - 1, to: currentYear },
  { label: `${currentYear - 2} – ${currentYear - 1}`, from: currentYear - 2, to: currentYear - 1 },
  { label: `${currentYear - 3} – ${currentYear - 2}`, from: currentYear - 3, to: currentYear - 2 },
];

interface YearData {
  no_losses: boolean;
  losses_confirmed: boolean;
  lines: Record<string, { loss_count: number; losses_paid: number }>;
}

const emptyYearData = (): YearData => ({
  no_losses: false,
  losses_confirmed: false,
  lines: Object.fromEntries(COVERAGE_LINES.map((l) => [l, { loss_count: 0, losses_paid: 0 }])),
});

const Step8LossHistory = ({ account }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noPriorCoverage, setNoPriorCoverage] = useState(false);
  const [yearDataMap, setYearDataMap] = useState<Record<string, YearData>>(() =>
    Object.fromEntries(YEAR_RANGES.map((yr) => [yr.label, emptyYearData()]))
  );

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
    if (data && data.length) {
      // Check if all entries have no_prior_coverage
      const allNoPrior = data.every((d) => d.no_prior_coverage);
      setNoPriorCoverage(allNoPrior);

      // Rebuild yearDataMap from stored policy_terms
      const newMap: Record<string, YearData> = Object.fromEntries(
        YEAR_RANGES.map((yr) => [yr.label, emptyYearData()])
      );

      // Parse stored data - each record is a coverage_type with policy_terms containing year data
      for (const record of data) {
        const terms = (record.policy_terms as any) || {};
        if (terms.year_data) {
          for (const [yearLabel, yd] of Object.entries(terms.year_data as Record<string, any>)) {
            if (newMap[yearLabel]) {
              newMap[yearLabel].no_losses = yd.no_losses ?? false;
              newMap[yearLabel].losses_confirmed = yd.losses_confirmed ?? false;
              if (yd.lines) {
                for (const [line, vals] of Object.entries(yd.lines as Record<string, any>)) {
                  if (newMap[yearLabel].lines[line]) {
                    newMap[yearLabel].lines[line] = vals as any;
                  }
                }
              }
            }
          }
          break; // Only need first record's year_data since we store all years together
        }
      }
      setYearDataMap(newMap);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("loss_history").delete().eq("account_id", account.id);

      // Store as a single record with all year data in policy_terms
      const toInsert = {
        account_id: account.id,
        coverage_type: "Combined",
        no_prior_coverage: noPriorCoverage,
        policy_terms: JSON.parse(JSON.stringify({ year_data: yearDataMap })),
      };
      const { error } = await supabase.from("loss_history").insert([toInsert]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loss-history"] });
      toast({ title: "Loss history saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateYearField = (yearLabel: string, line: string, field: "loss_count" | "losses_paid", value: number) => {
    setYearDataMap((prev) => ({
      ...prev,
      [yearLabel]: {
        ...prev[yearLabel],
        lines: {
          ...prev[yearLabel].lines,
          [line]: { ...prev[yearLabel].lines[line], [field]: value },
        },
      },
    }));
  };

  const toggleNoLosses = (yearLabel: string, checked: boolean) => {
    setYearDataMap((prev) => ({
      ...prev,
      [yearLabel]: {
        ...prev[yearLabel],
        no_losses: checked,
        lines: checked
          ? Object.fromEntries(COVERAGE_LINES.map((l) => [l, { loss_count: 0, losses_paid: 0 }]))
          : prev[yearLabel].lines,
      },
    }));
  };

  const toggleLossesConfirmed = (yearLabel: string, checked: boolean) => {
    setYearDataMap((prev) => ({
      ...prev,
      [yearLabel]: { ...prev[yearLabel], losses_confirmed: checked },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 8 — Loss History</h3>
        <p className="text-sm text-muted-foreground font-mono">Prior coverage and claims for each policy year</p>
      </div>

      {/* New Venture / No Prior Coverage */}
      <label className="flex items-center gap-3 p-3 rounded-md border border-border bg-secondary/30 cursor-pointer">
        <Checkbox
          checked={noPriorCoverage}
          onCheckedChange={(c) => setNoPriorCoverage(!!c)}
        />
        <div>
          <span className="text-sm font-medium">New Venture / No Prior Coverage</span>
          <p className="text-xs text-muted-foreground">Check if this is a new business with no prior insurance history</p>
        </div>
      </label>

      {!noPriorCoverage && (
        <div className="space-y-6">
          {YEAR_RANGES.map((yr) => {
            const yd = yearDataMap[yr.label];
            return (
              <div key={yr.label} className="p-4 rounded-md bg-secondary/30 border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-base">{yr.label}</h4>
                    <p className="text-xs text-muted-foreground">Physical Damage, Cargo</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={yd.no_losses}
                      onCheckedChange={(c) => toggleNoLosses(yr.label, !!c)}
                    />
                    No Losses
                  </label>
                </div>

                {!yd.no_losses && (
                  <div className="space-y-3">
                    {COVERAGE_LINES.map((line) => (
                      <div key={line} className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{line}: Loss Count (Open or Closed)</Label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground font-mono w-4">#</span>
                            <Input
                              type="number"
                              min={0}
                              value={yd.lines[line].loss_count}
                              onChange={(e) => updateYearField(yr.label, line, "loss_count", parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{line}: Losses Paid, Open or Reserved</Label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground font-mono w-4">$</span>
                            <Input
                              type="number"
                              min={0}
                              value={yd.lines[line].losses_paid}
                              onChange={(e) => updateYearField(yr.label, line, "losses_paid", parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Losses Confirmed toggle */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={yd.losses_confirmed}
                      onCheckedChange={(c) => toggleLossesConfirmed(yr.label, !!c)}
                    />
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Losses Confirmed
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={() => saveMutation.mutate()} className="w-full">Save Loss History</Button>
    </div>
  );
};

export default Step8LossHistory;
