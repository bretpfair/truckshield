import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const COMMODITY_OPTIONS = [
  "Agricultural/Farm Supplies",
  "Beverages",
  "Building Materials",
  "Chemicals",
  "Coal/Coke",
  "Commodities Dry Bulk",
  "Construction",
  "Dirt / Sand / Gravel",
  "Drive/Tow away",
  "Fresh Produce",
  "Garbage/Refuse",
  "General Freight",
  "Grain, Feed, Hay",
  "Household Goods",
  "Intermodal Cont.",
  "Liquids/Gases",
  "Livestock",
  "Logs, Poles, Beams, Lumber",
  "Machinery, Large Objects",
  "Meat",
  "Metal: sheets, coils, rolls",
  "Mobile Homes",
  "Motor Vehicles",
  "Oilfield Equipment",
  "Paper Products",
  "Passengers",
  "Refrigerated Food",
  "US Mail",
  "Utilities",
  "Water Well",
  "Other",
];

const req = (v: any) => (!v && v !== 0 ? "border-destructive/50" : "");

const Step4Commodities = ({ formData, updateFormData }: StepProps) => {
  const commodity = formData.commodity_info || {};
  const setCommodity = (key: string, value: any) => {
    updateFormData({ commodity_info: { ...commodity, [key]: value } });
  };

  const selectedCommodities: Record<string, string> = commodity.selected_commodities || {};
  const entries = Object.entries(selectedCommodities);

  // Initialize with one empty row if no commodities exist
  useEffect(() => {
    if (Object.keys(selectedCommodities).length === 0) {
      const first = COMMODITY_OPTIONS[0];
      setCommodity("selected_commodities", { [first]: "" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = entries.reduce((sum, [, pct]) => sum + (parseFloat(pct) || 0), 0);

  const addRow = () => {
    // Find first unused commodity
    const used = new Set(Object.keys(selectedCommodities));
    const next = COMMODITY_OPTIONS.find((o) => !used.has(o)) || "";
    if (next) {
      setCommodity("selected_commodities", { ...selectedCommodities, [next]: "" });
    }
  };

  const removeRow = (key: string) => {
    const updated = { ...selectedCommodities };
    delete updated[key];
    setCommodity("selected_commodities", updated);
  };

  const changeCommodity = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(selectedCommodities)) {
      if (k === oldKey) {
        updated[newKey] = v;
      } else {
        updated[k] = v;
      }
    }
    setCommodity("selected_commodities", updated);
  };

  const changePct = (key: string, value: string) => {
    setCommodity("selected_commodities", { ...selectedCommodities, [key]: value });
  };

  const usedKeys = new Set(Object.keys(selectedCommodities));

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


      {/* Commodity Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Commodities Hauled</Label>
          {entries.length > 0 && (
            <span className={`text-xs font-mono ${total === 100 ? "text-green-600" : "text-yellow-600"}`}>
              Total: {total}%
            </span>
          )}
        </div>

        {/* Header */}
        {entries.length > 0 && (
          <div className="grid grid-cols-[1fr_100px_40px] gap-3 px-1">
            <span className="text-xs font-mono text-muted-foreground">Commodity</span>
            <span className="text-xs font-mono text-muted-foreground">% of Loads</span>
            <span />
          </div>
        )}

        {entries.map(([key, pct]) => (
          <div key={key} className="grid grid-cols-[1fr_100px_40px] gap-3 items-center">
            <Select value={key} onValueChange={(v) => changeCommodity(key, v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMODITY_OPTIONS.filter((o) => o === key || !usedKeys.has(o)).map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className={total !== 100 ? req(pct) : ""}
              type="number"
              value={pct}
              onChange={(e) => changePct(key, e.target.value)}
              placeholder="%"
              min={0}
              max={100}
            />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(key)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addRow}
          className="gap-1"
          disabled={entries.length >= COMMODITY_OPTIONS.length}
        >
          <Plus className="h-3 w-3" /> New row
        </Button>
      </div>
    </div>
  );
};

export default Step4Commodities;
