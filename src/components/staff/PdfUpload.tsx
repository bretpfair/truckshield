import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";

interface ExtractedData {
  company_name?: string;
  dba_name?: string;
  dot_number?: string;
  mc_number?: string;
  ein_tax_id?: string;
  business_type?: string;
  business_owner_name?: string;
  business_owner_dob?: string;
  years_in_business?: number;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  annual_revenue?: number;
  fleet_size?: number;
  total_trucks?: number;
  total_drivers?: number;
  requested_effective_date?: string;
  operating_states?: string[];
  cargo_types?: string[];
  notes?: string;
  coverage_selections?: Record<string, unknown>;
  drivers?: Array<Record<string, unknown>>;
  vehicles?: Array<Record<string, unknown>>;
  garage_locations?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

const PdfUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setExtracted(null);
      setError(null);
    } else {
      toast({ title: "Please select a PDF file", variant: "destructive" });
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf-application`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Extraction failed");

      setExtracted(result.data);
      toast({ title: "Data extracted successfully!" });
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;
    setSaving(true);

    try {
      const { drivers, vehicles, garage_locations, ...accountFields } = extracted;

      // Check for existing account by DOT
      let accountId: string | null = null;
      let isUpdate = false;

      if (accountFields.dot_number) {
        const { data: existing } = await supabase
          .from("accounts")
          .select("id")
          .eq("dot_number", accountFields.dot_number)
          .maybeSingle();
        if (existing) {
          accountId = existing.id;
          isUpdate = true;
        }
      }

      if (isUpdate && accountId) {
        const { error } = await supabase
          .from("accounts")
          .update(accountFields as any)
          .eq("id", accountId);
        if (error) throw error;
      } else {
        accountFields.status = "lead";
        const { data, error } = await supabase
          .from("accounts")
          .insert(accountFields as any)
          .select("id")
          .single();
        if (error) throw error;
        accountId = data.id;
      }

      // Save drivers
      if (drivers?.length && accountId) {
        if (isUpdate) {
          await supabase.from("drivers").delete().eq("account_id", accountId);
        }
        const driverRows = drivers.map((d, i) => ({
          ...d,
          account_id: accountId,
          sort_order: i,
        }));
        const { error } = await supabase.from("drivers").insert(driverRows as any);
        if (error) console.error("Drivers insert error:", error);
      }

      // Save vehicles
      if (vehicles?.length && accountId) {
        if (isUpdate) {
          await supabase.from("power_units").delete().eq("account_id", accountId);
          await supabase.from("trailers").delete().eq("account_id", accountId);
        }
        const powerUnits = vehicles
          .filter((v) => !v.is_trailer)
          .map((v, i) => {
            const { is_trailer, vehicle_type, ...rest } = v;
            return { ...rest, truck_type: vehicle_type, account_id: accountId, sort_order: i };
          });
        const trailers = vehicles
          .filter((v) => v.is_trailer)
          .map((v, i) => {
            const { is_trailer, vehicle_type, ...rest } = v;
            return { ...rest, trailer_type: vehicle_type, account_id: accountId, sort_order: i };
          });

        if (powerUnits.length) {
          const { error } = await supabase.from("power_units").insert(powerUnits as any);
          if (error) console.error("Power units insert error:", error);
        }
        if (trailers.length) {
          const { error } = await supabase.from("trailers").insert(trailers as any);
          if (error) console.error("Trailers insert error:", error);
        }
      }

      // Save garage locations
      if (garage_locations?.length && accountId) {
        if (isUpdate) {
          await supabase.from("garage_locations").delete().eq("account_id", accountId);
        }
        const garageRows = garage_locations.map((g, i) => ({
          ...g,
          account_id: accountId,
          sort_order: i,
        }));
        const { error } = await supabase.from("garage_locations").insert(garageRows as any);
        if (error) console.error("Garage locations insert error:", error);
      }

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: `Account ${isUpdate ? "updated" : "created"} successfully!` });
      setExtracted(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  };

  const fieldLabels: Record<string, string> = {
    company_name: "Company Name",
    dba_name: "DBA Name",
    dot_number: "DOT #",
    mc_number: "MC #",
    ein_tax_id: "EIN / Tax ID",
    business_type: "Business Type",
    business_owner_name: "Owner Name",
    business_owner_dob: "Owner DOB",
    years_in_business: "Years in Business",
    mailing_address: "Address",
    mailing_city: "City",
    mailing_state: "State",
    mailing_zip: "ZIP",
    annual_revenue: "Annual Revenue",
    fleet_size: "Fleet Size",
    total_trucks: "Total Trucks",
    total_drivers: "Total Drivers",
    requested_effective_date: "Effective Date",
    operating_states: "Operating States",
    cargo_types: "Cargo Types",
    notes: "Notes",
  };

  const accountFields = extracted
    ? Object.entries(extracted).filter(
        ([key]) =>
          !["drivers", "vehicles", "garage_locations", "coverage_selections", "status"].includes(key) &&
          extracted[key] !== null &&
          extracted[key] !== undefined &&
          extracted[key] !== ""
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload PDF Application
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select a PDF application
                </p>
              </div>
            )}
          </div>

          {file && !extracted && (
            <Button
              onClick={handleExtract}
              disabled={extracting}
              className="w-full"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting data with AI...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Extract Application Data
                </>
              )}
            </Button>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted data preview */}
      {extracted && (
        <>
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                Extracted Account Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {accountFields.map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground font-mono">
                      {fieldLabels[key] || key}
                    </p>
                    <p className="text-sm font-medium whitespace-pre-wrap">
                      {renderValue(val)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {extracted.coverage_selections &&
            Object.keys(extracted.coverage_selections).length > 0 && (
              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    Coverage & Limits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(extracted.coverage_selections).map(
                      ([key, val]: [string, any]) => (
                        <div key={key} className="p-2 rounded bg-secondary/50">
                          <p className="text-xs text-muted-foreground font-mono capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm font-medium">
                            {val?.limit && `Limit: ${val.limit}`}
                            {val?.deductible && ` / Ded: ${val.deductible}`}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {extracted.drivers && extracted.drivers.length > 0 && (
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Drivers ({extracted.drivers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extracted.drivers.map((d: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium">
                        {d.first_name} {d.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {[
                          d.license_state && `License: ${d.license_state} ${d.license_number || ""}`,
                          d.date_of_birth && `DOB: ${d.date_of_birth}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{d.num_violations ?? 0} violations</Badge>
                      <Badge variant="outline">{d.num_accidents ?? 0} accidents</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {extracted.vehicles && extracted.vehicles.length > 0 && (
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Vehicles ({extracted.vehicles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extracted.vehicles.map((v: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-md bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium">
                        {v.year} {v.make} {v.model || ""}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {[
                          v.vehicle_type,
                          v.vin && `VIN: ${v.vin}`,
                          v.gvw_class,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={v.is_trailer ? "secondary" : "outline"}>
                        {v.is_trailer ? "Trailer" : "Power Unit"}
                      </Badge>
                      {v.physdam_amount && (
                        <Badge variant="outline">
                          ${Number(v.physdam_amount).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Save to Database
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setExtracted(null);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Discard
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default PdfUpload;
