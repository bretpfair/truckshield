import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface CarrierRow {
  id: string;
  name: string;
  am_best_rating: string | null;
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
  notes: string | null;
  is_active: boolean;
}

interface CriterionResult {
  name: string;
  status: "pass" | "fail" | "warn" | "na";
  detail: string;
}

interface CarrierMatch {
  carrier: CarrierRow;
  score: number;
  tier: "strong" | "partial" | "poor";
  criteria: CriterionResult[];
  passCount: number;
  failCount: number;
  warnCount: number;
}

function evaluateCarrier(account: any, carrier: CarrierRow): CarrierMatch {
  const criteria: CriterionResult[] = [];

  // 1. Cargo types
  if (carrier.preferred_cargo_types?.length && account.cargo_types?.length) {
    const overlap = account.cargo_types.filter((c: string) =>
      carrier.preferred_cargo_types!.some((p) => p.toLowerCase() === c.toLowerCase())
    );
    if (overlap.length === account.cargo_types.length) {
      criteria.push({ name: "Cargo Types", status: "pass", detail: `All ${overlap.length} cargo types match` });
    } else if (overlap.length > 0) {
      criteria.push({ name: "Cargo Types", status: "warn", detail: `${overlap.length}/${account.cargo_types.length} types match` });
    } else {
      criteria.push({ name: "Cargo Types", status: "fail", detail: "No cargo type overlap" });
    }
  } else {
    criteria.push({ name: "Cargo Types", status: "na", detail: "Not enough data" });
  }

  // 2. Excluded cargo
  if (carrier.excluded_cargo_types?.length && account.cargo_types?.length) {
    const excluded = account.cargo_types.filter((c: string) =>
      carrier.excluded_cargo_types!.some((e) => e.toLowerCase() === c.toLowerCase())
    );
    if (excluded.length > 0) {
      criteria.push({ name: "Excluded Cargo", status: "fail", detail: `Carrier excludes: ${excluded.join(", ")}` });
    } else {
      criteria.push({ name: "Excluded Cargo", status: "pass", detail: "No excluded cargo" });
    }
  }

  // 3. Operating states
  if (carrier.preferred_states?.length && account.operating_states?.length) {
    const overlap = account.operating_states.filter((s: string) =>
      carrier.preferred_states!.some((p) => p.toLowerCase() === s.toLowerCase())
    );
    if (overlap.length === account.operating_states.length) {
      criteria.push({ name: "Operating States", status: "pass", detail: `All ${overlap.length} states covered` });
    } else if (overlap.length > 0) {
      criteria.push({ name: "Operating States", status: "warn", detail: `${overlap.length}/${account.operating_states.length} states covered` });
    } else {
      criteria.push({ name: "Operating States", status: "fail", detail: "No state coverage overlap" });
    }
  } else {
    criteria.push({ name: "Operating States", status: "na", detail: "Not enough data" });
  }

  // 4. Excluded states
  if (carrier.excluded_states?.length && account.operating_states?.length) {
    const excluded = account.operating_states.filter((s: string) =>
      carrier.excluded_states!.some((e) => e.toLowerCase() === s.toLowerCase())
    );
    if (excluded.length > 0) {
      criteria.push({ name: "Excluded States", status: "fail", detail: `Carrier excludes: ${excluded.join(", ")}` });
    }
  }

  // 5. Fleet size
  if (account.fleet_size != null) {
    const min = carrier.min_fleet_size ?? 1;
    const max = carrier.max_fleet_size ?? 9999;
    if (account.fleet_size >= min && account.fleet_size <= max) {
      criteria.push({ name: "Fleet Size", status: "pass", detail: `${account.fleet_size} units (range: ${min}-${max})` });
    } else {
      criteria.push({ name: "Fleet Size", status: "fail", detail: `${account.fleet_size} units outside ${min}-${max} range` });
    }
  } else {
    criteria.push({ name: "Fleet Size", status: "na", detail: "Fleet size unknown" });
  }

  // 6. Claims history
  if (account.number_of_claims != null) {
    const maxClaims = carrier.max_claims_tolerance ?? 5;
    if (account.number_of_claims <= maxClaims) {
      criteria.push({ name: "Claims History", status: "pass", detail: `${account.number_of_claims} claims (max: ${maxClaims})` });
    } else {
      criteria.push({ name: "Claims History", status: "fail", detail: `${account.number_of_claims} claims exceeds ${maxClaims} limit` });
    }
  } else {
    criteria.push({ name: "Claims History", status: "na", detail: "Claims data missing" });
  }

  // 7. Years in business
  if (account.years_in_business != null && carrier.min_years_in_business) {
    if (account.years_in_business >= carrier.min_years_in_business) {
      criteria.push({ name: "Years in Business", status: "pass", detail: `${account.years_in_business} years (min: ${carrier.min_years_in_business})` });
    } else {
      criteria.push({ name: "Years in Business", status: "fail", detail: `${account.years_in_business} years below ${carrier.min_years_in_business} min` });
    }
  }

  // 8. Authority age
  if (account.date_of_authority && carrier.min_authority_age_months) {
    const authDate = new Date(account.date_of_authority);
    const monthsAge = Math.floor((Date.now() - authDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsAge >= carrier.min_authority_age_months) {
      criteria.push({ name: "Authority Age", status: "pass", detail: `${monthsAge} months (min: ${carrier.min_authority_age_months})` });
    } else {
      criteria.push({ name: "Authority Age", status: "fail", detail: `${monthsAge} months below ${carrier.min_authority_age_months} min` });
    }
  }

  // 9. Annual revenue
  if (account.annual_revenue != null || account.total_annual_revenue != null) {
    const rev = Number(account.annual_revenue || account.total_annual_revenue || 0);
    const minRev = Number(carrier.min_annual_revenue ?? 0);
    const maxRev = Number(carrier.max_annual_revenue ?? 999999999);
    if (rev >= minRev && rev <= maxRev) {
      criteria.push({ name: "Annual Revenue", status: "pass", detail: `$${rev.toLocaleString()} (range: $${minRev.toLocaleString()}-$${maxRev.toLocaleString()})` });
    } else {
      criteria.push({ name: "Annual Revenue", status: "fail", detail: `$${rev.toLocaleString()} outside $${minRev.toLocaleString()}-$${maxRev.toLocaleString()} range` });
    }
  }

  // 10. Authority requirement
  if (carrier.requires_authority && !account.carrier_authority_number && !account.dot_number) {
    criteria.push({ name: "Authority Required", status: "fail", detail: "No authority on file" });
  }

  // Calculate score
  const scored = criteria.filter((c) => c.status !== "na");
  const passCount = scored.filter((c) => c.status === "pass").length;
  const warnCount = scored.filter((c) => c.status === "warn").length;
  const failCount = scored.filter((c) => c.status === "fail").length;
  const total = scored.length || 1;
  const score = Math.round(((passCount + warnCount * 0.5) / total) * 100);

  const tier = score >= 70 ? "strong" : score >= 40 ? "partial" : "poor";

  return { carrier, score, tier, criteria, passCount, failCount, warnCount };
}

const tierColors = {
  strong: "bg-success/10 text-success border-success/20",
  partial: "bg-warning/10 text-warning border-warning/20",
  poor: "bg-destructive/10 text-destructive border-destructive/20",
};

const tierLabels = { strong: "Strong Match", partial: "Partial Match", poor: "Poor Match" };

const statusIcon = {
  pass: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  fail: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  na: <Info className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface Props {
  account: any;
  carriers: CarrierRow[];
  onGenerateQuote: (carrierId: string, score: number) => void;
  existingQuoteCarrierIds: string[];
}

const MarketGuidance = ({ account, carriers, onGenerateQuote, existingQuoteCarrierIds }: Props) => {
  const matches = useMemo(() => {
    return carriers
      .map((c) => evaluateCarrier(account, c))
      .sort((a, b) => b.score - a.score);
  }, [account, carriers]);

  const strongCount = matches.filter((m) => m.tier === "strong").length;
  const partialCount = matches.filter((m) => m.tier === "partial").length;

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Market Guidance
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {strongCount} strong match{strongCount !== 1 ? "es" : ""}, {partialCount} partial
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          {matches.map((m) => (
            <div key={m.carrier.id} className="rounded-lg border bg-card p-4 space-y-3">
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
                {existingQuoteCarrierIds.includes(m.carrier.id) ? (
                  <Badge variant="outline" className="text-[10px]">Quote Created</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={m.tier === "strong" ? "default" : "outline"}
                    onClick={() => onGenerateQuote(m.carrier.id, m.score)}
                  >
                    Generate Quote
                  </Button>
                )}
              </div>

              {/* Criteria breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {m.criteria.map((c) => (
                  <Tooltip key={c.name}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-default ${
                        c.status === "pass" ? "bg-success/5" :
                        c.status === "fail" ? "bg-destructive/5" :
                        c.status === "warn" ? "bg-warning/5" :
                        "bg-muted/30"
                      }`}>
                        {statusIcon[c.status]}
                        <span className="truncate">{c.name}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{c.detail}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Summary */}
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                <span className="text-success">{m.passCount} pass</span>
                <span className="text-warning">{m.warnCount} warn</span>
                <span className="text-destructive">{m.failCount} fail</span>
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">No carriers in the system yet.</p>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default MarketGuidance;
