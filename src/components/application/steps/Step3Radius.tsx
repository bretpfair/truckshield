import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const req = (v: any) => (!v && v !== 0 ? "border-destructive/50" : "");

const RADIUS_RANGES = [
  { key: "under_50", label: "Under 50 Miles", helper: "% of Hauls up to 50 Miles" },
  { key: "51_200", label: "51-200 Miles", helper: "% of Hauls 51-200 miles" },
  { key: "201_500", label: "201-500 Miles", helper: "% of Hauls 201-500 miles" },
  { key: "500_plus", label: "500+ Miles", helper: "% of Hauls over 500 miles" },
];

const OPERATION_TYPES = ["Interstate", "Intrastate", "Both"];

const Step3Radius = ({ formData, updateFormData }: StepProps) => {
  const radius = formData.radius_operations?.[0] || {};

  const updateField = (field: string, value: any) => {
    const updated = { ...radius, [field]: value };
    updateFormData({ radius_operations: [updated] });
  };

  const updateRadiusPct = (key: string, value: string) => {
    const details = { ...(radius.radius_details || {}), [key]: value };
    const updated = { ...radius, radius_details: details };
    updateFormData({ radius_operations: [updated] });
  };

  const radiusTotal = (): number => {
    const details = radius.radius_details || {};
    return RADIUS_RANGES.reduce((sum, r) => sum + (parseFloat(details[r.key]) || 0), 0);
  };

  const total = radiusTotal();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 3 — Radius & Areas of Operations</h3>
        <p className="text-sm text-muted-foreground font-mono">Operating radius and destination breakdown</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Interstate or Intrastate */}
        <div className="space-y-2">
          <Label className="font-semibold">Interstate or Intrastate?</Label>
          <p className="text-xs text-muted-foreground">
            Please indicate if your operations are within one state or across state lines (Must match their MCS-150 as shown on SAFER)
          </p>
          <Select value={radius.operation_type || ""} onValueChange={(v) => updateField("operation_type", v)}>
            <SelectTrigger className={req(radius.operation_type)}><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {OPERATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Annual Mileage */}
        <div className="space-y-2">
          <Label className="font-semibold">Annual Mileage</Label>
          <p className="text-xs text-muted-foreground">
            Subject to ongoing inspection via telematics and DOT data. Routes can change over time and mileage and radius must be updated as well by endorsement.
          </p>
          <Input
            className={req(radius.annual_mileage)}
            type="number"
            value={radius.annual_mileage || ""}
            onChange={(e) => updateField("annual_mileage", e.target.value)}
            placeholder="50000"
          />
        </div>
      </div>

      {/* Radius Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">Radius Details</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-xs">The area or areas where a company conducts its business. This is the distance the motor carrier may travel from their garaging location.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {total > 0 && (
            <span className={`text-xs font-mono ml-auto ${total === 100 ? "text-green-600" : "text-yellow-600"}`}>
              Total: {total}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RADIUS_RANGES.map((range) => (
            <div key={range.key} className="space-y-1.5">
              <Label className="text-sm">{range.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  className={total !== 100 ? req(radius.radius_details?.[range.key]) : ""}
                  type="number"
                  value={radius.radius_details?.[range.key] || ""}
                  onChange={(e) => updateRadiusPct(range.key, e.target.value)}
                  placeholder="0"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground font-mono">%</span>
              </div>
              <p className="text-xs text-muted-foreground">{range.helper}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step3Radius;
