import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TRAILER_TYPES, TRAILER_MAKES, US_STATES } from "../constants";
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
  ownership_type: "owned", lender_name: "", lender_address: "", lender_city: "", lender_state: "", lender_zip: "",
};

const cleanForInsert = (items: any[], accountId: string) =>
  items.map((t, i) => {
    const { id, created_at, updated_at, ...rest } = t;
    return {
      ...rest,
      account_id: accountId,
      sort_order: i,
      physdam_amount: t.physdam_amount ? parseFloat(t.physdam_amount) : null,
    };
  });

const Step6Trailers = ({ account, formData: parentFormData, updateFormData }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<any[]>([]);
  const noTrailers = !!(parentFormData.general_questions as any)?.no_trailers;

  const setNoTrailers = (val: boolean) => {
    dirtyRef.current = true;
    updateFormData({
      general_questions: { ...(parentFormData.general_questions || {}), no_trailers: val },
    });
  };

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

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (data && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      if (data.length > 0) {
        setItems(data);
      } else {
        const ownedCount = parentFormData?.total_owned_trailers || 0;
        if (ownedCount === 0 && !(parentFormData.general_questions as any)?.no_trailers) {
          updateFormData({
            general_questions: { ...(parentFormData.general_questions || {}), no_trailers: true },
          });
        }
        const targetCount = Math.max(1, Math.min(ownedCount || 1, 100));
        setItems(Array.from({ length: targetCount }, () => ({ ...emptyTrailer, account_id: account.id })));
      }
    }
  }, [data, account.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("trailers").delete().eq("account_id", account.id);
      if (!noTrailers) {
        const toInsert = cleanForInsert(items, account.id);
        const { error } = await supabase.from("trailers").insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trailers"] });
      toast({ title: "Trailers saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Track user edits vs initialization
  const dirtyRef = useRef(false);
  const itemsRef = useRef(items);
  const initializedRef = useRef(false);
  const noTrailersRef = useRef(noTrailers);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { noTrailersRef.current = noTrailers; }, [noTrailers]);
  useEffect(() => { if (data) initializedRef.current = true; }, [data]);

  // Debounced auto-save — only fires when dirty
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      saveMutation.mutate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [items, noTrailers]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (dirtyRef.current && initializedRef.current) {
        supabase.from("trailers").delete().eq("account_id", account.id).then(() => {
          if (!noTrailersRef.current && itemsRef.current.length > 0) {
            const toInsert = cleanForInsert(itemsRef.current, account.id);
            supabase.from("trailers").insert(toInsert).then(() => {
              queryClient.invalidateQueries({ queryKey: ["trailers"] });
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ["trailers"] });
          }
        });
      }
    };
  }, [account.id, queryClient]);

  const addItem = () => { dirtyRef.current = true; setItems(prev => [...prev, { ...emptyTrailer, account_id: account.id }]); };
  const removeItem = (idx: number) => { dirtyRef.current = true; setItems(prev => prev.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, field: string, value: any) => {
    dirtyRef.current = true;
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Section 6 — Trailers</h3>
          <p className="text-sm text-muted-foreground font-mono">Schedule each trailer</p>
        </div>
        {!noTrailers && (
          <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
            <Plus className="h-3 w-3" /> Add Trailer
          </Button>
        )}
      </div>

      <div className="p-4 rounded-md bg-secondary/30 border border-border flex items-center gap-3">
        <Checkbox
          id="no-trailers"
          checked={noTrailers}
          onCheckedChange={(checked) => setNoTrailers(!!checked)}
        />
        <div>
          <Label htmlFor="no-trailers" className="cursor-pointer font-medium">No Trailers</Label>
          <p className="text-xs text-muted-foreground">Check if this account does not have any trailers</p>
        </div>
      </div>

      {!noTrailers && items.map((item, idx) => (
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
              <Checkbox checked={item.has_physdam} onCheckedChange={(c) => updateItem(idx, "has_physdam", c)} />
              Include Physical Damage (Comp/Coll)
            </label>
            {item.has_physdam && (
              <div className="flex items-center gap-1">
                <Label className="text-xs">Stated Amount $</Label>
                <Input className="h-8 w-28" type="number" value={item.physdam_amount || ""} onChange={(e) => updateItem(idx, "physdam_amount", e.target.value)} />
              </div>
            )}
          </div>

          {/* Vehicle Ownership */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Trailer Ownership</Label>
            <div className="flex gap-4">
              {["owned", "leased", "financed"].map((type) => (
                <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name={`trailer-ownership-${idx}`}
                    checked={item.ownership_type === type}
                    onChange={() => updateItem(idx, "ownership_type", type)}
                    className="accent-primary"
                  />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </label>
              ))}
            </div>
            {(item.ownership_type === "leased" || item.ownership_type === "financed") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-md bg-background border border-border">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Lender / Lessor Name</Label>
                  <Input value={item.lender_name || ""} onChange={(e) => updateItem(idx, "lender_name", e.target.value)} placeholder="Company name" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input value={item.lender_address || ""} onChange={(e) => updateItem(idx, "lender_address", e.target.value)} placeholder="Street address" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input value={item.lender_city || ""} onChange={(e) => updateItem(idx, "lender_city", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">State</Label>
                  <Select value={item.lender_state || ""} onValueChange={(v) => updateItem(idx, "lender_state", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ZIP</Label>
                  <Input value={item.lender_zip || ""} onChange={(e) => updateItem(idx, "lender_zip", e.target.value)} maxLength={5} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      
    </div>
  );
};

export default Step6Trailers;