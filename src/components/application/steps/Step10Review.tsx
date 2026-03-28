import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
  onNavigateToStep?: (step: number) => void;
}

const Step10Review = ({ account, formData, onNavigateToStep }: StepProps) => {
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

  const gq = (formData.general_questions || {}) as any;
  const cov = formData.coverage_selections || {};
  const isNewVenture = !!gq.new_venture;

  const isStep1Complete = !!(
    formData.requested_effective_date &&
    formData.dot_number && formData.company_name &&
    formData.ein_tax_id && formData.business_type &&
    formData.business_owner_name && formData.business_owner_dob &&
    formData.contact_email && formData.contact_phone &&
    formData.mailing_address && formData.mailing_city && formData.mailing_state && formData.mailing_zip &&
    formData.years_in_business != null &&
    (formData.current_coverage_expiry || isNewVenture) &&
    (formData.business_categories || []).length > 0 &&
    formData.total_trucks != null && formData.total_drivers != null
  );

  const isStep3Complete = (() => {
    const r = formData.radius_operations?.[0] || {};
    const details = r.radius_details || {};
    const total = ["under_50", "51_200", "201_500", "500_plus"].reduce((s: number, k: string) => s + (parseFloat(details[k]) || 0), 0);
    return !!(r.operation_type && r.annual_mileage && total === 100);
  })();

  const isStep4Complete = (() => {
    const selected = formData.commodity_info?.selected_commodities || {};
    const total = Object.values(selected).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
    return Object.keys(selected).length > 0 && total === 100;
  })();

  const isStep5Complete = (powerUnits?.length || 0) > 0 && powerUnits!.every((u: any) => u.vin && u.year && u.make && u.truck_type && u.gvw_class && u.garage_zip && u.titled_state);

  const isStep6Complete = gq.no_trailers || ((trailers?.length || 0) > 0 && trailers!.every((t: any) => t.vin && t.year && t.make && t.trailer_type && t.garage_zip));

  const isStep7Complete = (drivers?.length || 0) > 0 && drivers!.every((d: any) =>
    d.first_name && d.last_name && d.date_of_birth &&
    d.license_number && d.license_state && d.license_type && d.driver_type &&
    d.original_issue_year && d.date_hired_year &&
    d.experience_years != null && d.lapse_suspension
  );

  const isStep9Complete = (() => {
    const autoQs = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12","q13","q14","q15","q16","q17"];
    const allAutoAnswered = autoQs.every(qId => {
      const q = gq[qId];
      if (!q) return false;
      const isNumberOnly = qId === "q17";
      if (isNumberOnly) return q.number != null && q.number !== "";
      return q.answer === "Yes" || q.answer === "No";
    });
    const hasGL = cov.general_liability && cov.general_liability !== "No Coverage";
    if (hasGL) {
      const glQs = ["gl1","gl2","gl3","gl4","gl5","gl6","gl7"];
      return allAutoAnswered && glQs.every(qId => {
        const q = gq[qId];
        return q && (q.answer === "Yes" || q.answer === "No");
      });
    }
    return allAutoAnswered;
  })();

  const sections = [
    { name: "Applicant Info", step: 1, complete: isStep1Complete },
    { name: "Coverage", step: 2, complete: !!(cov.primary_bipd && cov.icc_filing && cov.state_filing) },
    { name: "Radius & Operations", step: 3, complete: isStep3Complete },
    { name: "Commodities", step: 4, complete: isStep4Complete },
    { name: "Power Units", step: 5, complete: isStep5Complete },
    { name: "Trailers", step: 6, complete: isStep6Complete },
    { name: "Drivers", step: 7, complete: isStep7Complete },
    { name: "Loss History", step: 8, complete: (lossHistory?.length || 0) > 0 || isNewVenture },
    { name: "General Questions", step: 9, complete: isStep9Complete },
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
          <button
            key={section.name}
            onClick={() => onNavigateToStep?.(section.step)}
            className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border w-full text-left hover:bg-secondary/50 transition-colors cursor-pointer"
          >
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
          </button>
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
          <span>{powerUnits?.length || formData.total_trucks || 0}</span>
          <span className="text-muted-foreground">Trailers:</span>
          <span>{trailers?.length || (formData.total_owned_trailers || 0) + (formData.total_nonowned_trailers || 0) || 0}</span>
          <span className="text-muted-foreground">Drivers:</span>
          <span>{drivers?.length || formData.total_drivers || 0}</span>
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
