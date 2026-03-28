import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { US_STATES, BUSINESS_CATEGORIES, CONTRACTOR_TYPES, BUSINESS_TYPES } from "../constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, AlertTriangle } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step1Applicant = ({ account, formData, updateFormData }: StepProps) => {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [dotDuplicate, setDotDuplicate] = useState<{ company_name: string; id: string } | null>(null);

  const checkDotDuplicate = async (dotNumber: string) => {
    const clean = dotNumber.trim();
    if (!clean) { setDotDuplicate(null); return; }
    const { data } = await supabase
      .from("accounts")
      .select("id, company_name")
      .eq("dot_number", clean)
      .neq("id", account?.id || "")
      .limit(1);
    setDotDuplicate(data && data.length > 0 ? data[0] : null);
  };

  const toggleArrayItem = (field: string, item: string) => {
    const arr: string[] = formData[field] || [];
    updateFormData({
      [field]: arr.includes(item) ? arr.filter((i: string) => i !== item) : [...arr, item],
    });
  };

  const handleDotLookup = async () => {
    const dotNumber = formData.dot_number?.trim();
    if (!dotNumber) {
      toast.error("Please enter a DOT number first");
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("fmcsa-lookup", {
        body: { dotNumber },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Lookup failed");

      const carrier = data.data;
      const updates: Record<string, any> = {};

      // Only fill fields that have data from FMCSA
      if (carrier.company_name) updates.company_name = carrier.company_name;
      if (carrier.dba_name) updates.dba_name = carrier.dba_name;
      if (carrier.mc_number) updates.mc_number = carrier.mc_number;
      if (carrier.mailing_address) updates.mailing_address = carrier.mailing_address;
      if (carrier.mailing_city) updates.mailing_city = carrier.mailing_city;
      if (carrier.mailing_state) updates.mailing_state = carrier.mailing_state;
      if (carrier.mailing_zip) updates.mailing_zip = carrier.mailing_zip;
      if (carrier.contact_phone) updates.contact_phone = carrier.contact_phone;
      if (carrier.contact_email) updates.contact_email = carrier.contact_email;
      if (carrier.total_trucks != null) updates.total_trucks = carrier.total_trucks;
      if (carrier.total_drivers != null) updates.total_drivers = carrier.total_drivers;

      // Map FMCSA cargo carried to commodity_info
      if (Array.isArray(carrier.cargo_carried) && carrier.cargo_carried.length > 0) {
        const COMMODITY_OPTIONS = [
          "Agricultural/Farm Supplies", "Beverages", "Building Materials", "Chemicals",
          "Coal/Coke", "Commodities Dry Bulk", "Construction", "Dirt / Sand / Gravel",
          "Drive/Tow away", "Fresh Produce", "Garbage/Refuse", "General Freight",
          "Grain, Feed, Hay", "Household Goods", "Intermodal Cont.", "Liquids/Gases",
          "Livestock", "Logs, Poles, Beams, Lumber", "Machinery, Large Objects", "Meat",
          "Metal: sheets, coils, rolls", "Mobile Homes", "Motor Vehicles", "Oilfield Equipment",
          "Paper Products", "Passengers", "Refrigerated Food", "US Mail", "Utilities",
          "Water Well", "Other",
        ];
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        const optionMap = new Map(COMMODITY_OPTIONS.map((o) => [normalize(o), o]));
        const matched: string[] = [];
        for (const raw of carrier.cargo_carried as string[]) {
          const norm = normalize(raw);
          const exact = optionMap.get(norm);
          if (exact) {
            matched.push(exact);
          } else {
            for (const [key, val] of optionMap) {
              if (norm.includes(key) || key.includes(norm)) {
                if (!matched.includes(val)) matched.push(val);
                break;
              }
            }
          }
        }
        if (matched.length > 0) {
          const pct = Math.floor(100 / matched.length);
          const remainder = 100 - pct * matched.length;
          const selected: Record<string, string> = {};
          matched.forEach((m, i) => {
            selected[m] = (pct + (i === 0 ? remainder : 0)).toString();
          });
          updates.commodity_info = {
            ...(formData.commodity_info || {}),
            selected_commodities: selected,
          };
        }
      }

      if (Object.keys(updates).length > 0) {
        updateFormData(updates);
        toast.success(`Imported data for ${carrier.company_name || "DOT " + dotNumber}`, {
          description: `${Object.keys(updates).length} fields auto-filled from SAFER`,
        });
      } else {
        toast.warning("Carrier found but no mappable data returned");
      }
    } catch (err: any) {
      console.error("DOT lookup error:", err);
      toast.error("DOT Lookup Failed", {
        description: err.message || "Could not retrieve carrier data",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 1 — Applicant Information</h3>
        <p className="text-sm text-muted-foreground font-mono">Company details and business identity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Requested Effective Date</Label>
          <Input type="date" value={formData.requested_effective_date || ""} onChange={(e) => updateFormData({ requested_effective_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>DOT Number</Label>
          <div className="flex gap-2">
            <Input value={formData.dot_number || ""} onChange={(e) => { updateFormData({ dot_number: e.target.value }); checkDotDuplicate(e.target.value); }} placeholder="1234567" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDotLookup}
              disabled={isLookingUp || !formData.dot_number?.trim()}
              className="shrink-0 font-mono text-xs"
            >
              {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">SAFER</span>
            </Button>
          </div>
          {dotDuplicate && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-xs font-mono col-span-1 md:col-span-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>DOT# already exists on account <strong>"{dotDuplicate.company_name}"</strong></span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>MC Number (If applicable)</Label>
          <Input value={formData.mc_number || ""} onChange={(e) => updateFormData({ mc_number: e.target.value })} placeholder="MC-123456" />
        </div>
        <div className="space-y-2">
          <Label>Applicant Name (Legal Entity)</Label>
          <Input value={formData.company_name || ""} onChange={(e) => updateFormData({ company_name: e.target.value })} placeholder="Company legal name" />
        </div>
        <div className="space-y-2">
          <Label>DBA Name</Label>
          <Input value={formData.dba_name || ""} onChange={(e) => updateFormData({ dba_name: e.target.value })} placeholder="Doing Business As" />
        </div>
        <div className="space-y-2">
          <Label>EIN / Tax ID#</Label>
          <Input value={formData.ein_tax_id || ""} onChange={(e) => updateFormData({ ein_tax_id: e.target.value })} placeholder="XX-XXXXXXX" />
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Contact Information</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input value={formData.business_owner_name || ""} onChange={(e) => updateFormData({ business_owner_name: e.target.value })} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={formData.contact_email || ""} onChange={(e) => updateFormData({ contact_email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={formData.contact_phone || ""} onChange={(e) => updateFormData({ contact_phone: e.target.value })} placeholder="(555) 555-5555" />
          </div>
        </div>
      </div>

      {/* Mailing Address */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Mailing Address</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Street Address</Label>
            <Input value={formData.mailing_address || ""} onChange={(e) => updateFormData({ mailing_address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={formData.mailing_city || ""} onChange={(e) => updateFormData({ mailing_city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={formData.mailing_state || ""} onValueChange={(v) => updateFormData({ mailing_state: v })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ZIP Code</Label>
            <Input value={formData.mailing_zip || ""} onChange={(e) => updateFormData({ mailing_zip: e.target.value })} placeholder="12345" maxLength={5} />
          </div>
          <div className="space-y-2">
            <Label>County</Label>
            <Input value={formData.county || ""} onChange={(e) => updateFormData({ county: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Business Owner */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Business Owner</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={formData.business_owner_name || ""} onChange={(e) => updateFormData({ business_owner_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={formData.business_owner_dob || ""} onChange={(e) => updateFormData({ business_owner_dob: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Business Type</Label>
            <Select value={formData.business_type || ""} onValueChange={(v) => updateFormData({ business_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date of Authority</Label>
            <Input type="date" value={formData.date_of_authority || ""} onChange={(e) => updateFormData({ date_of_authority: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Years in Business & Coverage Expiry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Years in Business</Label>
          <Input type="number" value={formData.years_in_business ?? ""} onChange={(e) => updateFormData({ years_in_business: e.target.value ? parseInt(e.target.value) : null })} placeholder="0" min={0} />
        </div>
        <div className="space-y-2">
          <Label>Current Coverage Expiry Date</Label>
          <Input
            type="date"
            value={formData.current_coverage_expiry || ""}
            onChange={(e) => updateFormData({ current_coverage_expiry: e.target.value })}
            disabled={!!(formData.general_questions as any)?.new_venture}
          />
          <button
            type="button"
            onClick={() => {
              const current = (formData.general_questions as any)?.new_venture || false;
              const newVal = !current;
              updateFormData({
                general_questions: { ...(formData.general_questions || {}), new_venture: newVal },
                ...(newVal ? { current_coverage_expiry: null } : {}),
              });
            }}
            className={`mt-1 px-3 py-1.5 text-xs font-mono rounded-md border transition-colors w-full ${
              (formData.general_questions as any)?.new_venture
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
            }`}
          >
            {(formData.general_questions as any)?.new_venture ? "✓ " : ""}N/A — New Venture / No Prior Coverage
          </button>
        </div>
      </div>


      {/* Business Categories */}
      <div className="space-y-2">
        <Label>Business Categories</Label>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleArrayItem("business_categories", cat)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                (formData.business_categories || []).includes(cat)
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contractor sub-types */}
      {(formData.business_categories || []).includes("Contractors & Construction Services") && (
        <div className="space-y-2">
          <Label>Contractor Types</Label>
          <div className="flex flex-wrap gap-2">
            {CONTRACTOR_TYPES.map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => toggleArrayItem("contractor_types", ct)}
                className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                  (formData.contractor_types || []).includes(ct)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/20"
                }`}
              >
                {ct}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Projected Gross Receipts */}
      <div className="space-y-2">
        <Label>Projected Gross Receipts ($)</Label>
        <Input type="number" value={formData.projected_gross_receipts || ""} onChange={(e) => updateFormData({ projected_gross_receipts: e.target.value ? parseFloat(e.target.value) : null })} placeholder="2,500,000" />
      </div>

      {/* Fleet Summary */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Garage & Fleet Summary</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          <div className="space-y-2">
            <Label>Total Trucks</Label>
            <Input type="number" value={formData.total_trucks || ""} onChange={(e) => updateFormData({ total_trucks: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label>Owned Trailers</Label>
            <Input type="number" value={formData.total_owned_trailers || ""} onChange={(e) => updateFormData({ total_owned_trailers: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label>Non-Owned Trailers</Label>
            <Input type="number" value={formData.total_nonowned_trailers || ""} onChange={(e) => updateFormData({ total_nonowned_trailers: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label>Total Drivers</Label>
            <Input type="number" value={formData.total_drivers || ""} onChange={(e) => updateFormData({ total_drivers: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
        </div>
      {/* Notes - Description of Operations */}
      <div className="space-y-2">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Notes — Description of Operations</Label>
        <Textarea
          value={(formData.operation_info as any)?.notes || ""}
          onChange={(e) =>
            updateFormData({
              operation_info: { ...(formData.operation_info || {}), notes: e.target.value },
            })
          }
          placeholder="Describe the nature of the applicant's operations..."
          rows={4}
        />
      </div>
    </div>
    </div>
  );
};

export default Step1Applicant;
