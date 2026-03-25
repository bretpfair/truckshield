import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step10Review = ({ account, formData }: StepProps) => {
  const { data: powerUnits } = useQuery({
    queryKey: ["power-units", account.id],
    queryFn: async () => {
      const { data } = await supabase.from("power_units").select("*").eq("account_id", account.id);
      return data || [];
    },
  });

  const { data: trailers } = useQuery({
    queryKey: ["trailers", account.id],
    queryFn: async () => {
      const { data } = await supabase.from("trailers").select("*").eq("account_id", account.id);
      return data || [];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers", account.id],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").eq("account_id", account.id);
      return data || [];
    },
  });

  const { data: lossHistory } = useQuery({
    queryKey: ["loss-history", account.id],
    queryFn: async () => {
      const { data } = await supabase.from("loss_history").select("*").eq("account_id", account.id);
      return data || [];
    },
  });

  const sections = [
    { name: "Applicant Info", complete: !!(formData.dot_number && formData.company_name && formData.mailing_address) },
    { name: "Coverage", complete: !!(formData.coverage_selections?.primary_bipd) },
    { name: "Radius & Operations", complete: (formData.radius_operations || []).length > 0 && formData.radius_operations?.[0]?.max_radius },
    { name: "Commodities", complete: Object.keys(formData.commodity_info?.selected_commodities || {}).length > 0 },
    { name: "Power Units", complete: (powerUnits?.length || 0) > 0 },
    { name: "Trailers", complete: (trailers?.length || 0) > 0 },
    { name: "Drivers", complete: (drivers?.length || 0) > 0 },
    { name: "Loss History", complete: (lossHistory?.length || 0) > 0 },
    { name: "General Questions", complete: Object.keys(formData.general_questions || {}).length >= 5 },
  ];

  const completedCount = sections.filter((s) => s.complete).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Review & Submit</h3>
        <p className="text-sm text-muted-foreground font-mono">
          {completedCount}/{sections.length} sections complete
        </p>
      </div>

      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${(completedCount / sections.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.name} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border">
            <span className="text-sm font-medium">{section.name}</span>
            {section.complete ? (
              <Badge variant="outline" className="bg-success/10 text-success gap-1">
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning gap-1">
                <AlertCircle className="h-3 w-3" /> Incomplete
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-2">
        <h4 className="text-sm font-mono font-medium text-muted-foreground">Application Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Company:</span>
          <span>{formData.company_name || "—"}</span>
          <span className="text-muted-foreground">DOT:</span>
          <span>{formData.dot_number || "—"}</span>
          <span className="text-muted-foreground">Power Units:</span>
          <span>{powerUnits?.length || 0}</span>
          <span className="text-muted-foreground">Trailers:</span>
          <span>{trailers?.length || 0}</span>
          <span className="text-muted-foreground">Drivers:</span>
          <span>{drivers?.length || 0}</span>
          <span className="text-muted-foreground">Primary BI-PD:</span>
          <span>{formData.coverage_selections?.primary_bipd || "—"}</span>
        </div>
      </div>

      {completedCount < sections.length && (
        <p className="text-sm text-warning">
          ⚠ Please complete all sections before submitting. You can navigate back to incomplete sections using the step indicators above.
        </p>
      )}
    </div>
  );
};

export default Step10Review;
