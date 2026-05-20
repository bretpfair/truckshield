import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getAccountDataCompleteness } from "@/lib/getAccountDataCompleteness";

interface CarrierRow {
  id: string;
  name: string;
  am_best_rating: string | null;
  notes: string | null;
  appetite_guide: any;
  preferred_cargo_types: string[] | null;
  preferred_states: string[] | null;
  excluded_cargo_types: string[] | null;
  excluded_states: string[] | null;
  min_fleet_size: number | null;
  max_fleet_size: number | null;
  max_claims_tolerance: number | null;
  min_years_in_business: number | null;
  min_authority_age_months: number | null;
  min_annual_revenue: number | null;
  max_annual_revenue: number | null;
  accepted_business_types: string[] | null;
  max_radius_pct_over500: number | null;
  requires_authority: boolean | null;
  is_active: boolean;
}

interface AIEvaluation {
  carrier_id: string;
  score: number;
  tier: "strong" | "partial" | "poor";
  summary: string;
  strengths: string[];
  concerns: string[];
}

interface CarrierMatch extends AIEvaluation {
  carrier: CarrierRow;
}

const tierColors = {
  strong: "bg-success/10 text-success border-success/20",
  partial: "bg-warning/10 text-warning border-warning/20",
  poor: "bg-destructive/10 text-destructive border-destructive/20",
};

const tierLabels = { strong: "Strong Match", partial: "Partial Match", poor: "Poor Match" };

interface Props {
  account: any;
  carriers: CarrierRow[];
  drivers: any[];
  powerUnits: any[];
  trailers: any[];
  lossHistory: any[];
  onMarkSubmitted: (carrierId: string, score: number, carrierName: string) => void;
  submittedCarrierIds: string[];
}

const MarketGuidance = ({ account, carriers, drivers, powerUnits, trailers, lossHistory, onMarkSubmitted, submittedCarrierIds }: Props) => {
  const [matches, setMatches] = useState<CarrierMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);
  const [showHardBlockDialog, setShowHardBlockDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const completeness = useMemo(
    () => getAccountDataCompleteness({ account, powerUnits, drivers, lossHistory }),
    [account, powerUnits, drivers, lossHistory],
  );

  // Load saved results on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const { data, error } = await supabase
          .from("market_guidance_results")
          .select("*")
          .eq("account_id", account.id)
          .maybeSingle();

        if (error) {
          console.error("Failed to load saved market guidance:", error);
          setLoadingSaved(false);
          return;
        }

        if (data) {
          const savedEvals: AIEvaluation[] = (data.results as any) || [];
          const carrierMap = new Map(carriers.map((c) => [c.id, c]));
          const results: CarrierMatch[] = savedEvals
            .filter((e) => carrierMap.has(e.carrier_id))
            .map((e) => ({ ...e, carrier: carrierMap.get(e.carrier_id)! }))
            .sort((a, b) => b.score - a.score);

          setMatches(results);
          setLastChecked(new Date(data.checked_at));
        }
      } catch (err) {
        console.error("Error loading saved guidance:", err);
      } finally {
        setLoadingSaved(false);
      }
    };

    if (account?.id && carriers.length > 0) {
      loadSaved();
    } else {
      setLoadingSaved(false);
    }
  }, [account?.id, carriers]);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-market-guidance", {
        body: { account, carriers, drivers, powerUnits, trailers, lossHistory },
      });

      if (error) {
        const status = (error as any)?.status;
        if (status === 429) {
          toast({ title: "Rate limited", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (status === 402) {
          toast({ title: "Credits exhausted", description: "Add funds in Settings > Workspace > Usage.", variant: "destructive" });
        } else {
          toast({ title: "Evaluation failed", description: error.message || "Unknown error", variant: "destructive" });
        }
        return;
      }

      const evaluations: AIEvaluation[] = data?.evaluations || [];
      const carrierMap = new Map(carriers.map((c) => [c.id, c]));
      const results: CarrierMatch[] = evaluations
        .filter((e) => carrierMap.has(e.carrier_id))
        .map((e) => ({ ...e, carrier: carrierMap.get(e.carrier_id)! }))
        .sort((a, b) => b.score - a.score);

      setMatches(results);
      const now = new Date();
      setLastChecked(now);

      // Save/replace results in database (upsert on account_id unique index)
      const { error: saveError } = await supabase
        .from("market_guidance_results")
        .upsert(
          {
            account_id: account.id,
            results: evaluations as any,
            checked_at: now.toISOString(),
          },
          { onConflict: "account_id" }
        );

      if (saveError) {
        console.error("Failed to save market guidance results:", saveError);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to evaluate markets", variant: "destructive" });
    } finally {
      setLoading(false);
      setShowIncompleteDialog(false);
    }
  }, [account, carriers, drivers, powerUnits, trailers, lossHistory, toast]);

  const handleStartCheck = useCallback(() => {
    if (completeness.emptyApplication) {
      setShowHardBlockDialog(true);
      return;
    }
    if (!completeness.ready) {
      setShowIncompleteDialog(true);
      return;
    }
    runCheck();
  }, [completeness, runCheck]);

  const goToApplication = () => navigate(`/staff/accounts/${account.id}/application`);

  const strongCount = matches?.filter((m) => m.tier === "strong").length ?? 0;
  const partialCount = matches?.filter((m) => m.tier === "partial").length ?? 0;
  const checkButtonLabel = loading ? "Evaluating..." : matches ? "Re-check Markets" : "Check Markets";

  if (loadingSaved) {
    return (
      <Card className="glass-panel">
        <CardContent className="py-6 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
          <p className="text-sm">Loading market guidance...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> AI Market Guidance
              </CardTitle>
              {matches ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {strongCount} strong match{strongCount !== 1 ? "es" : ""}, {partialCount} partial
                  {lastChecked && (
                    <span className="ml-2 opacity-60">checked {lastChecked.toLocaleString()}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  AI evaluates carriers against the full account data including drivers, equipment, and loss history.
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleStartCheck}
              disabled={loading}
              className="gap-1.5 shrink-0"
              title={completeness.ready ? undefined : `Missing: ${completeness.missing.join(", ")}`}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {checkButtonLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!completeness.ready && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <div className="flex items-start gap-2 text-warning font-medium">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Market guidance needs more account data for reliable results.</span>
              </div>
              <ul className="mt-2 ml-6 list-disc text-xs text-muted-foreground space-y-1">
                {completeness.missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Button variant="link" className="h-auto p-0 mt-2 text-xs" onClick={goToApplication}>
                Go to application
              </Button>
            </div>
          )}

          {loading && !matches ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">AI is analyzing carrier appetite matches...</p>
              <p className="text-xs opacity-60 mt-1">This may take a few seconds.</p>
            </div>
          ) : !matches ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Click <strong>Check Markets</strong> to run an AI-powered carrier evaluation.</p>
            </div>
          ) : (
            <>
              {matches.map((m) => (
                <div key={m.carrier_id} className="rounded-lg border bg-card p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-center">
                        <span className={`text-xl font-bold font-mono ${
                          m.tier === "strong" ? "text-success" : m.tier === "partial" ? "text-warning" : "text-destructive"
                        }`}>
                          {m.score}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{m.carrier.name}</p>
                        <div className="flex items-center gap-2">
                          {m.carrier.am_best_rating && (
                            <span className="text-[10px] font-mono text-muted-foreground">AM Best: {m.carrier.am_best_rating}</span>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${tierColors[m.tier]}`}>
                            {tierLabels[m.tier]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {submittedCarrierIds.includes(m.carrier.id) ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">Submitted</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={m.tier === "strong" ? "default" : "outline"}
                        onClick={() => onMarkSubmitted(m.carrier.id, m.score, m.carrier.name)}
                      >
                        Mark as Submitted
                      </Button>
                    )}
                  </div>

                  {/* AI Summary */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.summary}</p>

                  {/* Strengths & Concerns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {m.strengths.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-mono text-success uppercase tracking-wider">Strengths</p>
                        {m.strengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.concerns.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-mono text-destructive uppercase tracking-wider">Concerns</p>
                        {m.concerns.map((c, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No carriers evaluated.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run market guidance with incomplete data?</AlertDialogTitle>
            <AlertDialogDescription>
              Results will be unreliable until the missing account sections are completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md bg-secondary/60 p-3 text-sm">
            <p className="font-medium mb-2">Missing items</p>
            <ul className="ml-5 list-disc text-muted-foreground space-y-1">
              {completeness.missing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={goToApplication}>Complete missing data</AlertDialogCancel>
            <AlertDialogAction onClick={runCheck}>Run anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showHardBlockDialog} onOpenChange={setShowHardBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Application data required</AlertDialogTitle>
            <AlertDialogDescription>
              This account does not have power units, commodities, or radius details yet. Market guidance cannot run until the application has baseline operating data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={goToApplication}>Go to application</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MarketGuidance;
