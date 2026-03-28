import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DRIVER_TYPES, LICENSE_TYPES, MONTHS, LAPSE_OPTIONS, US_STATES } from "../constants";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const emptyDriver = {
  first_name: "", last_name: "", date_of_birth: null, driver_type: "",
  license_number: "", license_state: "", license_type: "",
  original_issue_month: null, original_issue_year: null,
  date_hired_month: null, date_hired_year: null,
  experience_years: null, experience_months: null,
  lapse_suspension: "None", lapse_explanation: "",
  num_violations: 0, violations: [], num_accidents: 0, accidents: [],
};

const cleanForInsert = (items: any[], accountId: string) =>
  items.map((d, i) => {
    const { id, created_at, updated_at, ...rest } = d;
    return { ...rest, account_id: accountId, sort_order: i };
  });

const Step7Drivers = ({ account, formData: parentFormData }: StepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const { data } = useQuery({
    queryKey: ["drivers", account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("account_id", account.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const operationInfo = (parentFormData?.operation_info as any) || {};
  const ownerIsDriver = !!operationInfo.owner_is_driver;

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (data && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      let driverList: any[];
      if (data.length > 0) {
        driverList = [...data];
      } else {
        const targetCount = Math.max(1, Math.min(parentFormData?.total_drivers || 1, 100));
        driverList = Array.from({ length: targetCount }, () => ({ ...emptyDriver, account_id: account.id }));
      }

      if (ownerIsDriver && driverList.length > 0) {
        const nameParts = (parentFormData?.business_owner_name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const d1 = { ...driverList[0] };
        if (!d1.first_name) d1.first_name = firstName;
        if (!d1.last_name) d1.last_name = lastName;
        if (!d1.date_of_birth && parentFormData?.business_owner_dob) d1.date_of_birth = parentFormData.business_owner_dob;
        if (!d1.license_number && operationInfo.owner_license_number) d1.license_number = operationInfo.owner_license_number;
        if (!d1.license_state && operationInfo.owner_license_state) d1.license_state = operationInfo.owner_license_state;
        driverList[0] = d1;
      }

      setDrivers(driverList);
    }
  }, [data, account.id, ownerIsDriver]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("drivers").delete().eq("account_id", account.id);
      const toInsert = cleanForInsert(drivers, account.id);
      const { error } = await supabase.from("drivers").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast({ title: "Drivers saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Track user edits vs initialization
  const dirtyRef = useRef(false);
  const driversRef = useRef(drivers);
  const initializedRef = useRef(false);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { if (data) initializedRef.current = true; }, [data]);

  // Debounced auto-save — only fires when dirty
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => {
      dirtyRef.current = false;
      saveMutation.mutate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [drivers]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (dirtyRef.current && initializedRef.current && driversRef.current.length > 0) {
        const toInsert = cleanForInsert(driversRef.current, account.id);
        supabase.from("drivers").delete().eq("account_id", account.id).then(() => {
          supabase.from("drivers").insert(toInsert).then(() => {
            queryClient.invalidateQueries({ queryKey: ["drivers"] });
          });
        });
      }
    };
  }, [account.id, queryClient]);

  const addDriver = () => {
    dirtyRef.current = true;
    setDrivers(prev => {
      setExpandedIdx(prev.length);
      return [...prev, { ...emptyDriver, account_id: account.id }];
    });
  };
  const removeDriver = (idx: number) => { dirtyRef.current = true; setDrivers(prev => prev.filter((_, i) => i !== idx)); };
  const updateDriver = (idx: number, field: string, value: any) => {
    dirtyRef.current = true;
    setDrivers(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Section 7 — Scheduled Drivers</h3>
          <p className="text-sm text-muted-foreground font-mono">Add each driver with MVR details</p>
        </div>
        <Button variant="outline" size="sm" onClick={addDriver} className="gap-1">
          <Plus className="h-3 w-3" /> Add Driver
        </Button>
      </div>

      {drivers.map((drv, idx) => (
        <div key={idx} className="border border-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <span className="text-sm font-mono font-medium">
              Driver #{idx + 1} {drv.first_name ? `— ${drv.first_name} ${drv.last_name}` : ""}
            </span>
            <div className="flex items-center gap-2">
              {drivers.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); removeDriver(idx); }} className="p-1 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </span>
              )}
              {expandedIdx === idx ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>

          {expandedIdx === idx && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">First Name</Label>
                  <Input value={drv.first_name || ""} onChange={(e) => updateDriver(idx, "first_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input value={drv.last_name || ""} onChange={(e) => updateDriver(idx, "last_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={drv.date_of_birth || ""} onChange={(e) => updateDriver(idx, "date_of_birth", e.target.value || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Driver Type</Label>
                  <Select value={drv.driver_type || ""} onValueChange={(v) => updateDriver(idx, "driver_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{DRIVER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License Number</Label>
                  <Input value={drv.license_number || ""} onChange={(e) => updateDriver(idx, "license_number", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License State</Label>
                  <Select value={drv.license_state || ""} onValueChange={(v) => updateDriver(idx, "license_state", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License Type</Label>
                  <Select value={drv.license_type || ""} onValueChange={(v) => updateDriver(idx, "license_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{LICENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Issue & Hire Dates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Year Issued</Label>
                  <Input value={drv.original_issue_year || ""} onChange={(e) => updateDriver(idx, "original_issue_year", e.target.value ? parseInt(e.target.value) : null)} maxLength={4} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Month Hired</Label>
                  <Select value={drv.date_hired_month?.toString() || ""} onValueChange={(v) => updateDriver(idx, "date_hired_month", parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year Hired</Label>
                  <Input value={drv.date_hired_year || ""} onChange={(e) => updateDriver(idx, "date_hired_year", e.target.value ? parseInt(e.target.value) : null)} maxLength={4} />
                </div>
              </div>

              {/* Experience & Lapse */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Experience (Years)</Label>
                  <Select value={drv.experience_years?.toString() || ""} onValueChange={(v) => updateDriver(idx, "experience_years", parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Years" /></SelectTrigger>
                    <SelectContent>{[0,1,2,3,4,5,6,7].map((y) => <SelectItem key={y} value={y.toString()}>{y === 7 ? "7+" : y.toString()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lapse/Suspension</Label>
                  <Select value={drv.lapse_suspension || "None"} onValueChange={(v) => updateDriver(idx, "lapse_suspension", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LAPSE_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {drv.lapse_suspension && drv.lapse_suspension !== "None" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Explanation</Label>
                    <Input value={drv.lapse_explanation || ""} onChange={(e) => updateDriver(idx, "lapse_explanation", e.target.value)} />
                  </div>
                )}
              </div>

              {/* Violations & Accidents counts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Number of Violations (past 5 yrs)</Label>
                  <Input type="number" value={drv.num_violations || 0} onChange={(e) => updateDriver(idx, "num_violations", parseInt(e.target.value) || 0)} min={0} max={26} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Number of Accidents (past 5 yrs)</Label>
                  <Input type="number" value={drv.num_accidents || 0} onChange={(e) => updateDriver(idx, "num_accidents", parseInt(e.target.value) || 0)} min={0} max={26} />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      
    </div>
  );
};

export default Step7Drivers;