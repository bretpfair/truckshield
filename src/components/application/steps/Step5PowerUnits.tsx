import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GVW_CLASSES, TRUCK_TYPES, TRUCK_MAKES, US_STATES } from "../constants";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const emptyUnit = {
  vin: "", gvw_class: "", truck_type: "", is_service_vehicle: false,
  year: "", make: "", model: "", titled_state: "", garage_zip: "",
  roadside_assistance: false, has_physdam: false, physdam_amount: null, has_cargo: false,
};

const Step5PowerUnits = ({ account }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [units, setUnits] = useState<any[]>([]);
  const [decodingVin, setDecodingVin] = useState<Record<number, boolean>>({});

  const decodeVin = useCallback(async (vin: string, idx: number) => {
    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) return;

    setDecodingVin((prev) => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(cleanVin)}?format=json`
      );
      if (!res.ok) throw new Error("VIN lookup failed");
      const json = await res.json();
      const result = json.Results?.[0];
      if (!result) return;

      const updates: Record<string, string> = {};
      if (result.ModelYear && result.ModelYear !== "0") updates.year = result.ModelYear;
      if (result.Make) {
        const matched = TRUCK_MAKES.find((m) => m.toLowerCase() === result.Make.toLowerCase());
        if (matched) updates.make = matched;
      }
      if (result.Model) updates.model = result.Model;
      if (result.BodyClass) {
        const matched = TRUCK_TYPES.find((t) => t.toLowerCase() === result.BodyClass.toLowerCase());
        if (matched) updates.truck_type = matched;
      }

      if (Object.keys(updates).length > 0) {
        setUnits((prev) => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...updates };
          return copy;
        });
        toast({ title: "VIN decoded", description: `Found: ${Object.values(updates).join(", ")}` });
      }
    } catch {
      // Silent fail — user can fill manually
    } finally {
      setDecodingVin((prev) => ({ ...prev, [idx]: false }));
    }
  }, [toast]);

  const { data } = useQuery({
    queryKey: ["power-units", account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("power_units")
        .select("*")
        .eq("account_id", account.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setUnits(data.length ? data : [{ ...emptyUnit, account_id: account.id }]);
  }, [data, account.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing then insert all
      await supabase.from("power_units").delete().eq("account_id", account.id);
      const toInsert = units.map((u, i) => ({
        ...u,
        account_id: account.id,
        sort_order: i,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
        physdam_amount: u.physdam_amount ? parseFloat(u.physdam_amount) : null,
      }));
      const { error } = await supabase.from("power_units").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["power-units"] });
      toast({ title: "Power units saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addUnit = () => setUnits([...units, { ...emptyUnit, account_id: account.id }]);
  const removeUnit = (idx: number) => setUnits(units.filter((_, i) => i !== idx));
  const updateUnit = (idx: number, field: string, value: any) => {
    const updated = [...units];
    updated[idx] = { ...updated[idx], [field]: value };
    setUnits(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Section 5 — Power Units (Trucks)</h3>
          <p className="text-sm text-muted-foreground font-mono">Schedule each power unit</p>
        </div>
        <Button variant="outline" size="sm" onClick={addUnit} className="gap-1">
          <Plus className="h-3 w-3" /> Add Truck
        </Button>
      </div>

      {units.map((unit, idx) => (
        <div key={idx} className="p-4 rounded-md bg-secondary/30 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-mono font-medium">Truck #{idx + 1}</h4>
            {units.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeUnit(idx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">VIN</Label>
              <div className="relative">
                <Input
                  value={unit.vin || ""}
                  onChange={(e) => updateUnit(idx, "vin", e.target.value.toUpperCase())}
                  onBlur={(e) => decodeVin(e.target.value, idx)}
                  placeholder="17-character VIN"
                  maxLength={17}
                />
                {decodingVin[idx] && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">GVW Class</Label>
              <Select value={unit.gvw_class || ""} onValueChange={(v) => updateUnit(idx, "gvw_class", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{GVW_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Truck Type</Label>
              <Select value={unit.truck_type || ""} onValueChange={(v) => updateUnit(idx, "truck_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TRUCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input value={unit.year || ""} onChange={(e) => updateUnit(idx, "year", e.target.value)} placeholder="2024" maxLength={4} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Select value={unit.make || ""} onValueChange={(v) => updateUnit(idx, "make", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TRUCK_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input value={unit.model || ""} onChange={(e) => updateUnit(idx, "model", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Titled State</Label>
              <Select value={unit.titled_state || ""} onValueChange={(v) => updateUnit(idx, "titled_state", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Garage ZIP</Label>
              <Input value={unit.garage_zip || ""} onChange={(e) => updateUnit(idx, "garage_zip", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={unit.is_service_vehicle} onCheckedChange={(c) => updateUnit(idx, "is_service_vehicle", c)} />
              Service Vehicle
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={unit.roadside_assistance} onCheckedChange={(c) => updateUnit(idx, "roadside_assistance", c)} />
              Roadside Assistance
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={unit.has_cargo} onCheckedChange={(c) => updateUnit(idx, "has_cargo", c)} />
              Cargo Liability
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={unit.has_physdam} onCheckedChange={(c) => updateUnit(idx, "has_physdam", c)} />
              Physical Damage
            </label>
            {unit.has_physdam && (
              <div className="flex items-center gap-1">
                <Label className="text-xs">Stated Amount $</Label>
                <Input className="h-8 w-28" type="number" value={unit.physdam_amount || ""} onChange={(e) => updateUnit(idx, "physdam_amount", e.target.value)} />
              </div>
            )}
          </div>
        </div>
      ))}

      <Button onClick={() => saveMutation.mutate()} className="w-full">Save Power Units</Button>
    </div>
  );
};

export default Step5PowerUnits;
