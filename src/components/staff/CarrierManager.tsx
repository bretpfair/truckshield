import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Truck } from "lucide-react";

const CarrierManager = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    am_best_rating: "",
    preferred_cargo_types: "",
    preferred_states: "",
    min_fleet_size: "",
    max_fleet_size: "",
    max_claims_tolerance: "",
    notes: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: carriers, isLoading } = useQuery({
    queryKey: ["carriers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("carriers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addCarrier = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("carriers").insert({
        name: form.name,
        am_best_rating: form.am_best_rating || null,
        preferred_cargo_types: form.preferred_cargo_types ? form.preferred_cargo_types.split(",").map((s) => s.trim()) : null,
        preferred_states: form.preferred_states ? form.preferred_states.split(",").map((s) => s.trim()) : null,
        min_fleet_size: form.min_fleet_size ? parseInt(form.min_fleet_size) : 1,
        max_fleet_size: form.max_fleet_size ? parseInt(form.max_fleet_size) : 9999,
        max_claims_tolerance: form.max_claims_tolerance ? parseInt(form.max_claims_tolerance) : 5,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      setShowForm(false);
      setForm({ name: "", am_best_rating: "", preferred_cargo_types: "", preferred_states: "", min_fleet_size: "", max_fleet_size: "", max_claims_tolerance: "", notes: "" });
      toast({ title: "Carrier added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Carrier Database</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? "Cancel" : "Add Carrier"}
        </Button>
      </div>

      {showForm && (
        <Card className="glass-panel">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carrier Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Progressive Commercial" />
              </div>
              <div className="space-y-2">
                <Label>AM Best Rating</Label>
                <Input value={form.am_best_rating} onChange={(e) => setForm({ ...form, am_best_rating: e.target.value })} placeholder="A+" />
              </div>
              <div className="space-y-2">
                <Label>Preferred Cargo Types (comma-separated)</Label>
                <Input value={form.preferred_cargo_types} onChange={(e) => setForm({ ...form, preferred_cargo_types: e.target.value })} placeholder="General Freight, Refrigerated, Hazmat" />
              </div>
              <div className="space-y-2">
                <Label>Preferred States (comma-separated)</Label>
                <Input value={form.preferred_states} onChange={(e) => setForm({ ...form, preferred_states: e.target.value })} placeholder="TX, CA, FL, IL" />
              </div>
              <div className="space-y-2">
                <Label>Min Fleet Size</Label>
                <Input type="number" value={form.min_fleet_size} onChange={(e) => setForm({ ...form, min_fleet_size: e.target.value })} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Max Fleet Size</Label>
                <Input type="number" value={form.max_fleet_size} onChange={(e) => setForm({ ...form, max_fleet_size: e.target.value })} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Max Claims Tolerance</Label>
                <Input type="number" value={form.max_claims_tolerance} onChange={(e) => setForm({ ...form, max_claims_tolerance: e.target.value })} placeholder="5" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes / Appetite Guide</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Detailed appetite guide notes..." rows={4} />
            </div>
            <Button onClick={() => addCarrier.mutate()} disabled={!form.name}>Save Carrier</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm font-mono">Loading carriers...</p>
      ) : (
        <div className="space-y-2">
          {carriers?.map((c) => (
            <Card key={c.id} className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground font-mono">
                        {c.am_best_rating && <span>AM Best: {c.am_best_rating}</span>}
                        {c.preferred_cargo_types && <span>Cargo: {c.preferred_cargo_types.join(", ")}</span>}
                        {c.preferred_states && <span>States: {c.preferred_states.join(", ")}</span>}
                        <span>Fleet: {c.min_fleet_size}-{c.max_fleet_size}</span>
                      </div>
                      {c.notes && <p className="text-sm text-muted-foreground mt-2">{c.notes}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {carriers?.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No carriers yet. Add your first carrier above.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CarrierManager;
