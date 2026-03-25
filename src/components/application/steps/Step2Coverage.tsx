import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIMARY_BIPD_LIMITS, GL_OPTIONS, DEDUCTIBLE_OPTIONS, CARGO_VEHICLE_LIMITS, TRAILER_INTERCHANGE_OPTIONS } from "../constants";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step2Coverage = ({ formData, updateFormData }: StepProps) => {
  const coverage = formData.coverage_selections || {};
  const setCoverage = (key: string, value: any) => {
    updateFormData({ coverage_selections: { ...coverage, [key]: value } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 2 — Coverage Requested</h3>
        <p className="text-sm text-muted-foreground font-mono">Select your coverage types and limits</p>
      </div>

      {/* Primary Coverage */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Primary Coverage</Label>
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
            <Label>ICC Filing Required?</Label>
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
              <Label>Number of State Filings</Label>
              <Input type="number" value={coverage.num_state_filings || ""} onChange={(e) => setCoverage("num_state_filings", e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Uninsured Motorist BI</Label>
            <Select value={coverage.um_bi || ""} onValueChange={(v) => setCoverage("um_bi", v)}>
              <SelectTrigger><SelectValue placeholder="Select limit" /></SelectTrigger>
              <SelectContent>
                {PRIMARY_BIPD_LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Underinsured Motorist BI</Label>
            <Select value={coverage.uim_bi || ""} onValueChange={(v) => setCoverage("uim_bi", v)}>
              <SelectTrigger><SelectValue placeholder="Select limit" /></SelectTrigger>
              <SelectContent>
                {PRIMARY_BIPD_LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Supplemental Coverage */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Supplemental Coverage</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-2">
            <Label>General Liability</Label>
            <Select value={coverage.general_liability || ""} onValueChange={(v) => setCoverage("general_liability", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {GL_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Physical Damage Deductible</Label>
            <Select value={coverage.physdam_deductible || ""} onValueChange={(v) => setCoverage("physdam_deductible", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {DEDUCTIBLE_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cargo Liability Deductible</Label>
            <Select value={coverage.cargo_deductible || ""} onValueChange={(v) => setCoverage("cargo_deductible", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {DEDUCTIBLE_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cargo Limit</Label>
            <Select value={coverage.cargo_vehicle_limit || ""} onValueChange={(v) => setCoverage("cargo_vehicle_limit", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {CARGO_VEHICLE_LIMITS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trailer Interchange</Label>
            <Select value={coverage.trailer_interchange || ""} onValueChange={(v) => setCoverage("trailer_interchange", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {TRAILER_INTERCHANGE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hired/Non-Owned Coverage</Label>
            <Select value={coverage.hired_nonowned || ""} onValueChange={(v) => setCoverage("hired_nonowned", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coverage.hired_nonowned === "Yes" && (
            <>
              <div className="space-y-2">
                <Label>Total Employees</Label>
                <Input type="number" value={coverage.total_employees || ""} onChange={(e) => setCoverage("total_employees", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contractually Required?</Label>
                <Select value={coverage.contractually_required || ""} onValueChange={(v) => setCoverage("contractually_required", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Roadside Assistance</Label>
            <Select value={coverage.roadside_assistance || ""} onValueChange={(v) => setCoverage("roadside_assistance", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Terrorism Coverage</Label>
            <Select value={coverage.terrorism || ""} onValueChange={(v) => setCoverage("terrorism", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="Reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2Coverage;
