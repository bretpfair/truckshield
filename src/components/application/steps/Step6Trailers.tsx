import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TRAILER_TYPES, TRAILER_MAKES } from "../constants";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const emptyTrailer = {
  vin: "", is_nonowned: false, trailer_type: "", year: "", make: "", model: "",
  garage_zip: "", has_physdam: false, physdam_amount: null,
};

const Step6Trailers = ({ account }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<any[]>([]);

  const { data } = useQuery({
    queryKey: ["trailers", account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trailers")
        .select("*")
        .eq("account_id", account.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setItems(data.length ? data : [{ ...emptyTrailer, account_id: account.id }]);
  }, [data, account.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("trailers").delete().eq("account_id", account.id);
      const toInsert = items.map((t, i) => ({
        ...t,
        account_id: account.id,
        sort_order: i,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
        physdam_amount: t.physdam_amount ? parseFloat(t.physdam_amount) : null,
      }));
      const { error } = await supabase.from("trailers").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trailers"] });
      toast({ title: "Trailers saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addItem = () => setItems([...items, { ...emptyTrailer, account_id: account.id }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Section 6 — Trailers</h3>
          <p className="text-sm text-muted-foreground font-mono">Schedule each trailer</p>
        </div>
        <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
          <Plus className="h-3 w-3" /> Add Trailer
        </Button>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="p-4 rounded-md bg-secondary/30 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-mono font-medium">Trailer #{idx + 1}</h4>
            {items.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">VIN</Label>
              <Input value={item.vin || ""} onChange={(e) => updateItem(idx, "vin", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trailer Type</Label>
              <Select value={item.trailer_type || ""} onValueChange={(v) => updateItem(idx, "trailer_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TRAILER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input value={item.year || ""} onChange={(e) => updateItem(idx, "year", e.target.value)} maxLength={4} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Select value={item.make || ""} onValueChange={(v) => updateItem(idx, "make", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{TRAILER_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input value={item.model || ""} onChange={(e) => updateItem(idx, "model", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Garage ZIP</Label>
              <Input value={item.garage_zip || ""} onChange={(e) => updateItem(idx, "garage_zip", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={item.is_nonowned} onCheckedChange={(c) => updateItem(idx, "is_nonowned", c)} />
              Non-Owned Trailer
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={item.has_physdam} onCheckedChange={(c) => updateItem(idx, "has_physdam", c)} />
              Physical Damage
            </label>
            {item.has_physdam && (
              <div className="flex items-center gap-1">
                <Label className="text-xs">Stated Amount $</Label>
                <Input className="h-8 w-28" type="number" value={item.physdam_amount || ""} onChange={(e) => updateItem(idx, "physdam_amount", e.target.value)} />
              </div>
            )}
          </div>
        </div>
      ))}

      <Button onClick={() => saveMutation.mutate()} className="w-full">Save Trailers</Button>
    </div>
  );
};

export default Step6Trailers;
