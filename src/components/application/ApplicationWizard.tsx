import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WIZARD_STEPS } from "./constants";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
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
  const [currentStep, setCurrentStep] = useState(account.application_step || 1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initialize form data from account
    setFormData({
      ...account,
      coverage_selections: account.coverage_selections || {},
      radius_operations: account.radius_operations || [],
      commodity_info: account.commodity_info || {},
      general_questions: account.general_questions || {},
    });
  }, [account]);

  const updateAccount = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase
        .from("accounts")
        .update({ ...data, application_step: currentStep })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-accounts"] });
      toast({ title: "Progress saved" });
    },
    onError: (e: Error) => toast({ title: "Error saving", description: e.message, variant: "destructive" }),
  });

  const handleSave = (stepData?: Record<string, any>) => {
    const data = stepData || formData;
    updateAccount.mutate(data);
  };

  const handleNext = () => {
    handleSave();
    setCurrentStep((s: number) => Math.min(s + 1, WIZARD_STEPS.length));
  };

  const handlePrev = () => {
    setCurrentStep((s: number) => Math.max(s - 1, 1));
  };

  const updateFormData = (updates: Record<string, any>) => {
    setFormData((prev: Record<string, any>) => ({ ...prev, ...updates }));
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
      case 10: return <Step10Review {...props} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
              currentStep === step.id
                ? "bg-primary/20 text-primary border border-primary/40"
                : step.id < currentStep
                ? "bg-success/10 text-success border border-success/20"
                : "bg-secondary text-muted-foreground border border-border hover:border-primary/20"
            }`}
          >
            {step.id < currentStep ? (
              <Check className="h-3 w-3" />
            ) : (
              <span className="text-[10px] font-bold">{step.id}</span>
            )}
            <span className="hidden md:inline">{step.shortTitle}</span>
          </button>
        ))}
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
        <Button variant="ghost" onClick={() => handleSave()} className="gap-2">
          <Save className="h-4 w-4" /> Save Progress
        </Button>
        {currentStep < WIZARD_STEPS.length ? (
          <Button onClick={handleNext} className="gap-2">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => handleSave({ ...formData, status: "info_complete" })} className="gap-2 bg-success hover:bg-success/90">
            <Check className="h-4 w-4" /> Submit Application
          </Button>
        )}
      </div>
    </div>
  );
};

export default ApplicationWizard;
