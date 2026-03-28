import { ClipboardList, FileText, CheckCircle2, Shield } from "lucide-react";

const journeySteps = [
  { key: "submitted", label: "Application Submitted", icon: ClipboardList, statuses: ["info_complete", "quoting", "quoted", "bound"] },
  { key: "quoting", label: "Quoting in Progress", icon: FileText, statuses: ["quoting", "quoted", "bound"] },
  { key: "quoted", label: "Quotes Available", icon: CheckCircle2, statuses: ["quoted", "bound"] },
  { key: "bound", label: "Policy Bound", icon: Shield, statuses: ["bound"] },
];

interface JourneyTimelineProps {
  accountStatus: string;
}

const JourneyTimeline = ({ accountStatus }: JourneyTimelineProps) => {
  const isPreSubmit = ["lead", "pending_info"].includes(accountStatus);

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto pb-1">
      {journeySteps.map((step, idx) => {
        const isActive = step.statuses.includes(accountStatus);
        const isCurrent = step.key === accountStatus || (step.key === "submitted" && accountStatus === "info_complete");
        const StepIcon = step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground scale-110 shadow-md"
                    : isActive
                    ? "border-success bg-success/15 text-success"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-mono text-center leading-tight max-w-[80px] sm:max-w-none ${
                  isCurrent
                    ? "text-primary font-bold"
                    : isActive
                    ? "text-success font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < journeySteps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full min-w-[16px] ${
                  journeySteps[idx + 1].statuses.includes(accountStatus)
                    ? "bg-success"
                    : isCurrent
                    ? "bg-gradient-to-r from-primary/60 to-border"
                    : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default JourneyTimeline;
