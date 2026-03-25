import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMMODITY_CLASSES } from "../constants";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step4Commodities = ({ formData, updateFormData }: StepProps) => {
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const commodity = formData.commodity_info || {};
  const setCommodity = (key: string, value: any) => {
    updateFormData({ commodity_info: { ...commodity, [key]: value } });
  };

  const selectedCommodities: Record<string, string> = commodity.selected_commodities || {};

  const toggleCommodity = (item: string) => {
    const updated = { ...selectedCommodities };
    if (updated[item] !== undefined) {
      delete updated[item];
    } else {
      updated[item] = "";
    }
    setCommodity("selected_commodities", updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 4 — Commodity Information</h3>
        <p className="text-sm text-muted-foreground font-mono">What cargo types do you haul?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Hazardous Materials?</Label>
          <Select value={commodity.hazardous_materials || ""} onValueChange={(v) => setCommodity("hazardous_materials", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Owned Commodities?</Label>
          <Select value={commodity.owned_commodities || ""} onValueChange={(v) => setCommodity("owned_commodities", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Intermodal Exposure?</Label>
          <Select value={commodity.intermodal_exposure || ""} onValueChange={(v) => setCommodity("intermodal_exposure", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Projected Gross Receipts ($)</Label>
        <Input type="number" value={formData.projected_gross_receipts || ""} onChange={(e) => updateFormData({ projected_gross_receipts: e.target.value ? parseFloat(e.target.value) : null })} placeholder="2,500,000" />
      </div>

      {/* Commodity Classes */}
      <div className="space-y-2">
        <Label>Select Commodities Hauled</Label>
        <div className="space-y-2">
          {COMMODITY_CLASSES.map((cls) => (
            <div key={cls.name} className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedClass(expandedClass === cls.name ? null : cls.name)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <span className="text-sm font-medium">{cls.name}</span>
                {expandedClass === cls.name ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {expandedClass === cls.name && (
                <div className="p-3 flex flex-wrap gap-2">
                  {cls.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleCommodity(item)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                        selectedCommodities[item] !== undefined
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Allocation */}
      {Object.keys(selectedCommodities).length > 0 && (
        <div className="space-y-2">
          <Label>Revenue % per Commodity (must total 100%)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(selectedCommodities).map(([item, pct]) => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{item}</span>
                <Input
                  type="number"
                  className="h-8 w-20"
                  value={pct}
                  onChange={(e) => {
                    const updated = { ...selectedCommodities, [item]: e.target.value };
                    setCommodity("selected_commodities", updated);
                  }}
                  placeholder="%"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Commodities;
