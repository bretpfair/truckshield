import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISTANCE_RANGES, US_STATES } from "../constants";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step3Radius = ({ formData, updateFormData }: StepProps) => {
  const radius = formData.radius_operations || [{ max_radius: "", hauled_by_distance: {}, destinations: {} }];

  const updateRadius = (index: number, field: string, value: any) => {
    const updated = [...radius];
    updated[index] = { ...updated[index], [field]: value };
    updateFormData({ radius_operations: updated });
  };

  const updateDistance = (index: number, range: string, value: string) => {
    const updated = [...radius];
    updated[index] = {
      ...updated[index],
      hauled_by_distance: { ...(updated[index].hauled_by_distance || {}), [range]: value },
    };
    updateFormData({ radius_operations: updated });
  };

  const toggleDestination = (index: number, state: string) => {
    const updated = [...radius];
    const dests = { ...(updated[index].destinations || {}) };
    if (dests[state] !== undefined) {
      delete dests[state];
    } else {
      dests[state] = "";
    }
    updated[index] = { ...updated[index], destinations: dests };
    updateFormData({ radius_operations: updated });
  };

  const updateDestPct = (index: number, state: string, value: string) => {
    const updated = [...radius];
    updated[index] = {
      ...updated[index],
      destinations: { ...(updated[index].destinations || {}), [state]: value },
    };
    updateFormData({ radius_operations: updated });
  };

  const distTotal = (index: number): number => {
    const hbd: Record<string, string> = radius[index]?.hauled_by_distance || {};
    return Object.values(hbd).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 3 — Radius & Areas of Operations</h3>
        <p className="text-sm text-muted-foreground font-mono">Operating radius and destination breakdown</p>
      </div>

      {radius.map((loc: any, idx: number) => (
        <div key={idx} className="space-y-4 p-4 rounded-md bg-secondary/30 border border-border">
          <h4 className="font-medium text-sm font-mono">
            {idx === 0 ? "Principal Garage Location" : `Garage Location ${idx + 1}`}
          </h4>

          <div className="space-y-2">
            <Label>Maximum Radius (miles)</Label>
            <Input type="number" value={loc.max_radius || ""} onChange={(e) => updateRadius(idx, "max_radius", e.target.value)} placeholder="500" />
          </div>

          {/* Hauled by Distance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Hauled by Distance (must total 100%)</Label>
              <span className={`text-xs font-mono ${distTotal(idx) === 100 ? "text-success" : "text-warning"}`}>
                Total: {distTotal(idx)}%
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DISTANCE_RANGES.map((range) => (
                <div key={range} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono min-w-[120px]">{range}</span>
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={loc.hauled_by_distance?.[range] || ""}
                    onChange={(e) => updateDistance(idx, range, e.target.value)}
                    placeholder="%"
                    min={0}
                    max={100}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Destinations */}
          <div className="space-y-2">
            <Label>Destination States (click to select, enter % for each)</Label>
            <div className="flex flex-wrap gap-1.5">
              {US_STATES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleDestination(idx, st)}
                  className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                    loc.destinations?.[st] !== undefined
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            {Object.keys(loc.destinations || {}).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {Object.entries(loc.destinations || {}).map(([state, pct]) => (
                  <div key={state} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary">{state}</span>
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={pct || ""}
                      onChange={(e) => updateDestPct(idx, state, e.target.value)}
                      placeholder="%"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Step3Radius;
