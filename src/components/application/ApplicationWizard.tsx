import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sendClientInvite } from "@/lib/sendClientInvite";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WIZARD_STEPS } from "./constants";
import { Check, ChevronLeft, ChevronRight, Loader2, AlertTriangle, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileWarning } from "lucide-react";
import Step1Applicant from "./steps/Step1Applicant";
import Step2Coverage from "./steps/Step2Coverage";
import Step3Radius from "./steps/Step3Radius";
import Step4Commodities from "./steps/Step4Commodities";
import Step5PowerUnits from "./steps/Step5PowerUnits";
import Step6Trailers from "./steps/Step6Trailers";
import Step7Drivers from "./steps/Step7Drivers";
import Step8LossHistory from "./steps/Step8LossHistory";
import Step9Questions from "./steps/Step9Questions";
import Step10Review from "./steps/Step10Review";

interface ApplicationWizardProps {
  account: any;
}

const ApplicationWizard = ({ account }: ApplicationWizardProps) => {
  const isPreview = !account?.id || !/^[0-9a-f]{8}-/.test(account.id);
  const [currentStep, setCurrentStep] = useState(account.application_step || 1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showRadiusError, setShowRadiusError] = useState(false);
  const [showCommodityError, setShowCommodityError] = useState(false);
  const [showCabCardWarning, setShowCabCardWarning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = useRef(false);

  // Queries for section completion awareness
  const { data: puData } = useQuery({
    queryKey: ["power-units", account.id],
    queryFn: async () => {
      if (isPreview) return [];
      const { data } = await supabase.from("power_units").select("id,vin,gvw_class,truck_type,year,make,model,titled_state,garage_zip,ownership_type,lender_name").eq("account_id", account.id);
      return data || [];
    },
  });
  const { data: trData } = useQuery({
    queryKey: ["trailers", account.id],
    queryFn: async () => {
      if (isPreview) return [];
      const { data } = await supabase.from("trailers").select("id,vin,trailer_type,year,make,model,garage_zip,ownership_type,lender_name").eq("account_id", account.id);
      return data || [];
    },
  });
  const { data: drData } = useQuery({
    queryKey: ["drivers", account.id],
    queryFn: async () => {
      if (isPreview) return [];
      const { data } = await supabase.from("drivers").select("id,first_name,last_name,date_of_birth,license_number,license_state,license_type,driver_type,original_issue_year,date_hired_year,experience_years,lapse_suspension").eq("account_id", account.id);
      return data || [];
    },
  });
  const { data: lhData } = useQuery({
    queryKey: ["loss-history", account.id],
    queryFn: async () => {
      if (isPreview) return [];
      const { data } = await supabase.from("loss_history").select("id").eq("account_id", account.id);
      return data || [];
    },
  });

  const getStepComplete = (stepId: number): boolean => {
    const gq = (formData.general_questions || {}) as any;
    const cov = formData.coverage_selections || {};
    const opInfo = (formData.operation_info || {}) as any;
    const isNewVenture = !!gq.new_venture;

    switch (stepId) {
      case 1: return !!(
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
      case 2: return !!(cov.primary_bipd && cov.icc_filing && cov.state_filing);
      case 3: {
        const r = formData.radius_operations?.[0] || {};
        const details = r.radius_details || {};
        const total = ["under_50", "51_200", "201_500", "500_plus"].reduce((s: number, k: string) => s + (parseFloat(details[k]) || 0), 0);
        return !!(r.operation_type && r.annual_mileage && total === 100);
      }
      case 4: {
        const selected = formData.commodity_info?.selected_commodities || {};
        const total = Object.values(selected).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
        return Object.keys(selected).length > 0 && total === 100;
      }
      case 5: {
        if ((puData?.length || 0) === 0) return false;
        return puData!.every((u: any) => u.vin && u.year && u.make && u.truck_type && u.gvw_class && u.garage_zip && u.titled_state);
      }
      case 6: {
        if (gq.no_trailers) return true;
        if ((trData?.length || 0) === 0) return false;
        return trData!.every((t: any) => t.vin && t.year && t.make && t.trailer_type && t.garage_zip);
      }
      case 7: {
        if ((drData?.length || 0) === 0) return false;
        return drData!.every((d: any) =>
          d.first_name && d.last_name && d.date_of_birth &&
          d.license_number && d.license_state && d.license_type && d.driver_type &&
          d.original_issue_year && d.date_hired_year &&
          d.experience_years != null && d.lapse_suspension
        );
      }
      case 8: return (lhData?.length || 0) > 0 || isNewVenture;
      case 9: {
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
          const allGlAnswered = glQs.every(qId => {
            const q = gq[qId];
            return q && (q.answer === "Yes" || q.answer === "No");
          });
          return allAutoAnswered && allGlAnswered;
        }
        return allAutoAnswered;
      }
      default: return true;
    }
  };

  useEffect(() => {
    setFormData({
      ...account,
      coverage_selections: account.coverage_selections || {},
      radius_operations: account.radius_operations || [],
      commodity_info: account.commodity_info || {},
      general_questions: account.general_questions || {},
      operation_info: account.operation_info || {},
    });
    // Mark initialized after first load so we don't auto-save the initial set
    setTimeout(() => { isInitialized.current = true; }, 500);
  }, [account]);

  const updateAccount = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (isPreview) return; // Skip DB writes in preview mode
      const { error } = await supabase
        .from("accounts")
        .update({ ...data, application_step: currentStep })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: async (_: void, variables: Record<string, any>) => {
      queryClient.invalidateQueries({ queryKey: ["client-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account", account.id] });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);

      // Auto-send invite if contact_email was just added
      const newEmail = variables.contact_email;
      const hadEmail = account.contact_email;
      if (newEmail && !hadEmail) {
        try {
          const result = await sendClientInvite({
            accountId: account.id,
            email: newEmail,
            companyName: account.company_name,
          });
          if (result.sent) {
            toast({ title: "Client invite sent", description: result.message });
          }
        } catch {
          // Non-fatal: don't block the save
        }
      }
    },
    onError: (e: Error) => toast({ title: "Error saving", description: e.message, variant: "destructive" }),
  });

  const debouncedSave = useCallback((data: Record<string, any>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setAutoSaveStatus("saving");
    debounceTimer.current = setTimeout(() => {
      updateAccount.mutate(data);
    }, 1500);
  }, [currentStep, account.id]);

  const handleSave = (stepData?: Record<string, any>) => {
    const data = stepData || formData;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    updateAccount.mutate(data);
  };

  const getRadiusTotal = (): number => {
    const radius = formData.radius_operations?.[0] || {};
    const details = radius.radius_details || {};
    const keys = ["under_50", "51_200", "201_500", "500_plus"];
    return keys.reduce((sum, k) => sum + (parseFloat(details[k]) || 0), 0);
  };

  const getCommodityTotal = (): number => {
    const commodity = formData.commodity_info || {};
    const selected: Record<string, string> = commodity.selected_commodities || {};
    return Object.values(selected).reduce((sum, pct) => sum + (parseFloat(pct) || 0), 0);
  };

  const checkCabCards = async (): Promise<boolean> => {
    if (isPreview) return true;
    const { data: powerUnits } = await supabase
      .from("power_units")
      .select("cab_card_path")
      .eq("account_id", account.id);
    if (!powerUnits || powerUnits.length === 0) return true;
    const missing = powerUnits.some((u) => !u.cab_card_path);
    return !missing;
  };

  const proceedFromStep = () => {
    handleSave();
    setCurrentStep((s: number) => Math.min(s + 1, WIZARD_STEPS.length));
  };

  const handleNext = async () => {
    if (currentStep === 3 && getRadiusTotal() !== 100) {
      setShowRadiusError(true);
      return;
    }
    if (currentStep === 4 && getCommodityTotal() !== 100) {
      setShowCommodityError(true);
      return;
    }
    if (currentStep === 5) {
      const allHaveCabCards = await checkCabCards();
      if (!allHaveCabCards) {
        setShowCabCardWarning(true);
        return;
      }
    }
    proceedFromStep();
  };

  const handlePrev = () => {
    handleSave();
    setCurrentStep((s: number) => Math.max(s - 1, 1));
  };

  const updateFormData = (updates: Record<string, any>) => {
    setFormData((prev: Record<string, any>) => {
      const next = { ...prev, ...updates };
      if (isInitialized.current) debouncedSave(next);
      return next;
    });
  };

  const renderStep = () => {
    const props = { account, formData, updateFormData, onSave: handleSave };
    switch (currentStep) {
      case 1: return <Step1Applicant {...props} />;
      case 2: return <Step2Coverage {...props} />;
      case 3: return <Step3Radius {...props} />;
      case 4: return <Step4Commodities {...props} />;
      case 5: return <Step5PowerUnits {...props} />;
      case 6: return <Step6Trailers {...props} />;
      case 7: return <Step7Drivers {...props} />;
      case 8: return <Step8LossHistory {...props} />;
      case 9: return <Step9Questions {...props} />;
      case 10: return <Step10Review {...props} onNavigateToStep={(step: number) => setCurrentStep(step)} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isVisited = step.id < currentStep;
          const stepComplete = step.id < 10 ? getStepComplete(step.id) : true;
          const isIncompleteVisited = isVisited && !stepComplete;
          
          let className = "";
          if (isActive) {
            className = "bg-primary/20 text-primary border border-primary/40";
          } else if (isIncompleteVisited) {
            className = "bg-warning/10 text-warning border border-warning/30";
          } else if (isVisited) {
            className = "bg-success/10 text-success border border-success/20";
          } else {
            className = "bg-secondary text-muted-foreground border border-border hover:border-primary/20";
          }

          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${className}`}
            >
              {isVisited && !isIncompleteVisited ? (
                <Check className="h-3 w-3" />
              ) : isIncompleteVisited ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <span className="text-[10px] font-bold">{step.id}</span>
              )}
              <span className="hidden md:inline">{step.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / WIZARD_STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <Card className="glass-panel">
        <CardContent className="pt-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
          {autoSaveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
          {autoSaveStatus === "saved" && <><Check className="h-3 w-3 text-success" /> Saved</>}
        </span>
        {currentStep < WIZARD_STEPS.length ? (
          <Button onClick={handleNext} className="gap-2">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={async () => {
              handleSave({ ...formData, status: "info_complete" });
              // Send application-received confirmation email
              if (!isPreview && account.contact_email) {
                try {
                  const ownerName = formData.business_owner_name || "";
                  const firstName = ownerName.split(" ")[0] || "";
                  await supabase.functions.invoke("send-transactional-email", {
                    body: {
                      templateName: "application-received",
                      recipientEmail: account.contact_email,
                      idempotencyKey: `app-received-${account.id}`,
                      templateData: {
                        companyName: formData.company_name || account.company_name,
                        firstName,
                      },
                    },
                  });
                } catch {
                  // Non-fatal: don't block the submit
                }
              }
              toast({ title: "Application submitted!", description: "Your application has been received. Our team will begin working on it." });
            }}
            className="gap-2 bg-success hover:bg-success/90"
            disabled={!Array.from({ length: 9 }, (_, i) => i + 1).every(getStepComplete)}
          >
            <Check className="h-4 w-4" /> Submit Application
          </Button>
        )}
      </div>

      <AlertDialog open={showRadiusError} onOpenChange={setShowRadiusError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Radius Details Must Equal 100%
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your radius percentages currently total <strong>{getRadiusTotal()}%</strong>. Please adjust the values so they add up to exactly <strong>100%</strong> before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowRadiusError(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCommodityError} onOpenChange={setShowCommodityError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Commodities Must Equal 100%
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your commodity percentages currently total <strong>{getCommodityTotal()}%</strong>. Please adjust the values so they add up to exactly <strong>100%</strong> before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCommodityError(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCabCardWarning} onOpenChange={setShowCabCardWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-yellow-500" />
              Missing Cab Card / Registration
            </AlertDialogTitle>
            <AlertDialogDescription>
              One or more power units are missing a Cab Card or Registration upload. <strong>Some markets require a Cab Card or Registration to release quotes.</strong> Would you like to go back and upload them, or continue without?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCabCardWarning(false)}>Go Back & Upload</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowCabCardWarning(false); proceedFromStep(); }}>
              Continue Without
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApplicationWizard;
