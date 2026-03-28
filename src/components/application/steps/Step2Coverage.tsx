import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { PRIMARY_BIPD_LIMITS, GL_OPTIONS, DEDUCTIBLE_OPTIONS, CARGO_VEHICLE_LIMITS, TRAILER_INTERCHANGE_OPTIONS } from "../constants";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const SUPPLEMENTAL_COVERAGES = [
  {
    key: "general_liability",
    label: "General Liability",
    description: "Covers third-party bodily injury and property damage claims not related to auto operations.",
    fields: [
      { key: "general_liability_limit", label: "GL Limit", type: "select", options: GL_OPTIONS },
    ],
  },
  {
    key: "physical_damage",
    label: "Physical Damage",
    description: "Covers damage to your own trucks (comprehensive & collision).",
    fields: [
      { key: "physdam_deductible", label: "Deductible", type: "select", options: DEDUCTIBLE_OPTIONS },
    ],
  },
  {
    key: "cargo_liability",
    label: "Cargo Liability",
    description: "Covers loss or damage to freight you are hauling.",
    fields: [
      { key: "cargo_vehicle_limit", label: "Cargo Limit (per vehicle)", type: "select", options: CARGO_VEHICLE_LIMITS },
      { key: "cargo_deductible", label: "Cargo Deductible", type: "select", options: DEDUCTIBLE_OPTIONS },
      { key: "include_reefer", label: "Include Reefer Coverage", type: "checkbox" },
    ],
  },
  {
    key: "trailer_interchange",
    label: "Trailer Interchange",
    description: "Covers physical damage to non-owned trailers used under a trailer interchange agreement.",
    fields: [
      { key: "trailer_interchange_limit", label: "Interchange Limit", type: "select", options: TRAILER_INTERCHANGE_OPTIONS.filter(o => o !== "No Coverage") },
    ],
  },
  {
    key: "hired_nonowned",
    label: "Hired / Non-Owned Auto",
    description: "Covers liability for vehicles you hire or employees' personal vehicles used for business.",
    fields: [
      { key: "total_employees", label: "Total Employees", type: "number" },
      { key: "contractually_required", label: "Contractually Required?", type: "yesno" },
    ],
  },
  {
    key: "roadside_assistance",
    label: "Roadside Assistance / Towing",
    description: "Emergency roadside service and towing coverage for breakdowns.",
    fields: [],
  },
  {
    key: "terrorism",
    label: "Terrorism Coverage (TRIA)",
    description: "Federal terrorism risk insurance act coverage.",
    fields: [],
  },
];

const Step2Coverage = ({ formData, updateFormData }: StepProps) => {
  const coverage = formData.coverage_selections || {};
  const setCoverage = (key: string, value: any) => {
    updateFormData({ coverage_selections: { ...coverage, [key]: value } });
  };

  const toggleSupplemental = (key: string, checked: boolean) => {
    const updated = { ...coverage, [key]: checked };
    // Clear follow-up fields when unchecked
    if (!checked) {
      const def = SUPPLEMENTAL_COVERAGES.find(c => c.key === key);
      def?.fields.forEach(f => { updated[f.key] = undefined; });
    }
    updateFormData({ coverage_selections: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 2 — Coverage Requested</h3>
        <p className="text-sm text-muted-foreground font-mono">Select your coverage types and limits</p>
      </div>

      {/* AUTO LIABILITY LIMITS */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Auto Liability Limits</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-2">
            <Label>Primary BI-PD Limit</Label>
            <Select value={coverage.primary_bipd || ""} onValueChange={(v) => setCoverage("primary_bipd", v)}>
              <SelectTrigger><SelectValue placeholder="Select limit" /></SelectTrigger>
              <SelectContent>
                {PRIMARY_BIPD_LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>DOT Filing Required?</Label>
            <Select value={coverage.icc_filing || ""} onValueChange={(v) => setCoverage("icc_filing", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>State Filing Required?</Label>
            <Select value={coverage.state_filing || ""} onValueChange={(v) => setCoverage("state_filing", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coverage.state_filing === "Yes" && (
            <div className="space-y-2">
              <Label>CA # or Other State ID</Label>
              <Input type="number" value={coverage.num_state_filings || ""} onChange={(e) => setCoverage("num_state_filings", e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Uninsured/Underinsured Motorist BI</Label>
            <Select value={coverage.um_bi || ""} onValueChange={(v) => setCoverage("um_bi", v)}>
              <SelectTrigger><SelectValue placeholder="Select limit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="State Minimum">State Minimum</SelectItem>
                {PRIMARY_BIPD_LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Supplemental Coverage */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Supplemental Coverage</Label>
        <p className="text-sm text-muted-foreground mt-1 mb-3">Select the additional coverages you need. Follow-up questions will appear for each selected coverage.</p>
        <div className="space-y-3">
          {SUPPLEMENTAL_COVERAGES.map((cov) => {
            const isSelected = !!coverage[cov.key];
            return (
              <Card
                key={cov.key}
                className={`transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "border-border"}`}
              >
                <CardContent className="py-4 px-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`cov-${cov.key}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleSupplemental(cov.key, !!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label htmlFor={`cov-${cov.key}`} className="font-medium cursor-pointer text-sm">
                        {cov.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">{cov.description}</p>
                    </div>
                  </div>

                  {isSelected && cov.fields.length > 0 && (
                    <div className="pl-7 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                      {cov.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label className="text-sm">{field.label}</Label>
                          {field.type === "select" && (
                            <Select value={coverage[field.key] || ""} onValueChange={(v) => setCoverage(field.key, v)}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {field.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          {field.type === "number" && (
                            <Input
                              type="number"
                              value={coverage[field.key] || ""}
                              onChange={(e) => setCoverage(field.key, e.target.value)}
                            />
                          )}
                          {field.type === "yesno" && (
                            <Select value={coverage[field.key] || ""} onValueChange={(v) => setCoverage(field.key, v)}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Yes</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {field.type === "checkbox" && (
                            <div className="flex items-center gap-2 pt-1">
                              <Checkbox
                                id={`field-${field.key}`}
                                checked={!!coverage[field.key]}
                                onCheckedChange={(checked) => setCoverage(field.key, !!checked)}
                              />
                              <label htmlFor={`field-${field.key}`} className="text-sm cursor-pointer">{field.label}</label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Step2Coverage;
