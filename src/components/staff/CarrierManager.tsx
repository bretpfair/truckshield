import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Truck, Upload, FileText, Pencil, Trash2 } from "lucide-react";

const INITIAL_FORM = {
  name: "",
  am_best_rating: "",
  preferred_cargo_types: "",
  preferred_states: "",
  excluded_cargo_types: "",
  excluded_states: "",
  min_fleet_size: "",
  max_fleet_size: "",
  max_claims_tolerance: "",
  min_years_in_business: "",
  min_authority_age_months: "",
  min_annual_revenue: "",
  max_annual_revenue: "",
  accepted_business_types: "",
  max_radius_pct_over500: "",
  requires_authority: false,
  notes: "",
};

const CarrierManager = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
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

  const splitCsv = (s: string) => s ? s.split(",").map((v) => v.trim()).filter(Boolean) : null;
  const intOrNull = (s: string) => s ? parseInt(s) : null;
  const numOrNull = (s: string) => s ? parseFloat(s) : null;

  const buildPayload = () => ({
    name: form.name,
    am_best_rating: form.am_best_rating || null,
    preferred_cargo_types: splitCsv(form.preferred_cargo_types),
    preferred_states: splitCsv(form.preferred_states),
    excluded_cargo_types: splitCsv(form.excluded_cargo_types) || [],
    excluded_states: splitCsv(form.excluded_states) || [],
    min_fleet_size: intOrNull(form.min_fleet_size) ?? 1,
    max_fleet_size: intOrNull(form.max_fleet_size) ?? 9999,
    max_claims_tolerance: intOrNull(form.max_claims_tolerance) ?? 5,
    min_years_in_business: intOrNull(form.min_years_in_business) ?? 0,
    min_authority_age_months: intOrNull(form.min_authority_age_months) ?? 0,
    min_annual_revenue: numOrNull(form.min_annual_revenue) ?? 0,
    max_annual_revenue: numOrNull(form.max_annual_revenue) ?? 999999999,
    accepted_business_types: splitCsv(form.accepted_business_types) || [],
    max_radius_pct_over500: intOrNull(form.max_radius_pct_over500) ?? 100,
    requires_authority: form.requires_authority,
    notes: form.notes || null,
  });

  const saveCarrier = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editingId) {
        const { error } = await supabase.from("carriers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("carriers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      resetForm();
      toast({ title: editingId ? "Carrier updated" : "Carrier added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCarrier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("carriers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      toast({ title: "Carrier deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setPdfFile(null);
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      am_best_rating: c.am_best_rating || "",
      preferred_cargo_types: c.preferred_cargo_types?.join(", ") || "",
      preferred_states: c.preferred_states?.join(", ") || "",
      excluded_cargo_types: c.excluded_cargo_types?.join(", ") || "",
      excluded_states: c.excluded_states?.join(", ") || "",
      min_fleet_size: c.min_fleet_size?.toString() || "",
      max_fleet_size: c.max_fleet_size?.toString() || "",
      max_claims_tolerance: c.max_claims_tolerance?.toString() || "",
      min_years_in_business: c.min_years_in_business?.toString() || "",
      min_authority_age_months: c.min_authority_age_months?.toString() || "",
      min_annual_revenue: c.min_annual_revenue?.toString() || "",
      max_annual_revenue: c.max_annual_revenue?.toString() || "",
      accepted_business_types: c.accepted_business_types?.join(", ") || "",
      max_radius_pct_over500: c.max_radius_pct_over500?.toString() || "",
      requires_authority: c.requires_authority || false,
      notes: c.notes || "",
    });
    setShowForm(true);
  };

  const handlePdfExtract = async () => {
    if (!pdfFile) return;
    setExtracting(true);
    try {
      // Upload PDF to storage
      const filePath = `appetite-guides/${Date.now()}-${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("appetite-guides")
        .upload(filePath, pdfFile);
      if (uploadError) throw uploadError;

      // Call AI extraction edge function
      const { data, error } = await supabase.functions.invoke("extract-appetite-guide", {
        body: { filePath },
      });
      if (error) throw error;

      // Populate form with extracted data
      const ext = data.extracted;
      setForm((prev) => ({
        ...prev,
        name: ext.name || prev.name,
        preferred_cargo_types: ext.preferred_cargo_types?.join(", ") || prev.preferred_cargo_types,
        preferred_states: ext.preferred_states?.join(", ") || prev.preferred_states,
        excluded_cargo_types: ext.excluded_cargo_types?.join(", ") || prev.excluded_cargo_types,
        excluded_states: ext.excluded_states?.join(", ") || prev.excluded_states,
        min_fleet_size: ext.min_fleet_size?.toString() || prev.min_fleet_size,
        max_fleet_size: ext.max_fleet_size?.toString() || prev.max_fleet_size,
        max_claims_tolerance: ext.max_claims_tolerance?.toString() || prev.max_claims_tolerance,
        min_years_in_business: ext.min_years_in_business?.toString() || prev.min_years_in_business,
        min_authority_age_months: ext.min_authority_age_months?.toString() || prev.min_authority_age_months,
        min_annual_revenue: ext.min_annual_revenue?.toString() || prev.min_annual_revenue,
        max_annual_revenue: ext.max_annual_revenue?.toString() || prev.max_annual_revenue,
        accepted_business_types: ext.accepted_business_types?.join(", ") || prev.accepted_business_types,
        max_radius_pct_over500: ext.max_radius_pct_over500?.toString() || prev.max_radius_pct_over500,
        requires_authority: ext.requires_authority ?? prev.requires_authority,
        notes: ext.notes || prev.notes,
      }));

      toast({ title: "Appetite guide extracted", description: "Review and adjust the fields below." });
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const f = (key: keyof typeof form, value: string | boolean) => setForm({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Carrier Database</h3>
        <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? "Cancel" : "Add Carrier"}
        </Button>
      </div>

      {showForm && (
        <Card className="glass-panel">
          <CardContent className="p-6 space-y-6">
            {/* PDF Upload Section */}
            <div className="p-4 rounded-lg border-2 border-dashed border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3 mb-2">
                <Upload className="h-5 w-5 text-primary" />
                <p className="font-medium text-sm">Upload Appetite Guide PDF</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a carrier's appetite guide and AI will extract the criteria automatically.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handlePdfExtract}
                  disabled={!pdfFile || extracting}
                >
                  {extracting ? "Extracting..." : "Extract"}
                </Button>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Basic Info</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Carrier Name *</Label>
                  <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Progressive Commercial" />
                </div>
                <div className="space-y-2">
                  <Label>AM Best Rating</Label>
                  <Input value={form.am_best_rating} onChange={(e) => f("am_best_rating", e.target.value)} placeholder="A+" />
                </div>
              </div>
            </div>

            {/* Appetite Criteria */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Appetite Criteria</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferred Cargo Types</Label>
                  <Input value={form.preferred_cargo_types} onChange={(e) => f("preferred_cargo_types", e.target.value)} placeholder="General Freight, Refrigerated, Hazmat" />
                </div>
                <div className="space-y-2">
                  <Label>Excluded Cargo Types</Label>
                  <Input value={form.excluded_cargo_types} onChange={(e) => f("excluded_cargo_types", e.target.value)} placeholder="Livestock, Explosives" />
                </div>
                <div className="space-y-2">
                  <Label>Preferred States</Label>
                  <Input value={form.preferred_states} onChange={(e) => f("preferred_states", e.target.value)} placeholder="TX, CA, FL, IL" />
                </div>
                <div className="space-y-2">
                  <Label>Excluded States</Label>
                  <Input value={form.excluded_states} onChange={(e) => f("excluded_states", e.target.value)} placeholder="NY, NJ" />
                </div>
                <div className="space-y-2">
                  <Label>Accepted Business Types</Label>
                  <Input value={form.accepted_business_types} onChange={(e) => f("accepted_business_types", e.target.value)} placeholder="LLC, Corporation, Sole Proprietor" />
                </div>
              </div>
            </div>

            {/* Thresholds */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Underwriting Thresholds</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Min Fleet Size</Label>
                  <Input type="number" value={form.min_fleet_size} onChange={(e) => f("min_fleet_size", e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-2">
                  <Label>Max Fleet Size</Label>
                  <Input type="number" value={form.max_fleet_size} onChange={(e) => f("max_fleet_size", e.target.value)} placeholder="500" />
                </div>
                <div className="space-y-2">
                  <Label>Max Claims</Label>
                  <Input type="number" value={form.max_claims_tolerance} onChange={(e) => f("max_claims_tolerance", e.target.value)} placeholder="5" />
                </div>
                <div className="space-y-2">
                  <Label>Min Years in Business</Label>
                  <Input type="number" value={form.min_years_in_business} onChange={(e) => f("min_years_in_business", e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-2">
                  <Label>Min Authority Age (months)</Label>
                  <Input type="number" value={form.min_authority_age_months} onChange={(e) => f("min_authority_age_months", e.target.value)} placeholder="18" />
                </div>
                <div className="space-y-2">
                  <Label>Min Annual Revenue ($)</Label>
                  <Input type="number" value={form.min_annual_revenue} onChange={(e) => f("min_annual_revenue", e.target.value)} placeholder="100000" />
                </div>
                <div className="space-y-2">
                  <Label>Max Annual Revenue ($)</Label>
                  <Input type="number" value={form.max_annual_revenue} onChange={(e) => f("max_annual_revenue", e.target.value)} placeholder="10000000" />
                </div>
                <div className="space-y-2">
                  <Label>Max % Long Haul (500+ mi)</Label>
                  <Input type="number" value={form.max_radius_pct_over500} onChange={(e) => f("max_radius_pct_over500", e.target.value)} placeholder="50" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Switch checked={form.requires_authority} onCheckedChange={(v) => f("requires_authority", v)} />
                <Label>Requires active carrier authority</Label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes / Additional Appetite Details</Label>
              <Textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Detailed appetite guide notes..." rows={4} />
            </div>

            <Button onClick={() => saveCarrier.mutate()} disabled={!form.name}>
              {editingId ? "Update Carrier" : "Save Carrier"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm font-mono">Loading carriers...</p>
      ) : (
        <div className="space-y-2">
          {carriers?.map((c: any) => (
            <Card key={c.id} className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Truck className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{c.name}</p>
                        {c.am_best_rating && <Badge variant="outline" className="text-[10px]">AM Best: {c.am_best_rating}</Badge>}
                        {c.appetite_pdf_path && <FileText className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {c.preferred_cargo_types?.length > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            Cargo: {c.preferred_cargo_types.join(", ")}
                          </span>
                        )}
                        {c.preferred_states?.length > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            States: {c.preferred_states.join(", ")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground font-mono">
                          Fleet: {c.min_fleet_size}-{c.max_fleet_size}
                        </span>
                        {c.min_years_in_business > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            Min {c.min_years_in_business}yr exp
                          </span>
                        )}
                        {c.min_authority_age_months > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            Auth: {c.min_authority_age_months}mo+
                          </span>
                        )}
                      </div>
                      {c.notes && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCarrier.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
