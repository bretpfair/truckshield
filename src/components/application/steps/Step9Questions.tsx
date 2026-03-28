import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AUTO_LIABILITY_QUESTIONS, GL_QUESTIONS } from "../constants";

interface StepProps {
  account: any;
  formData: Record<string, any>;
  updateFormData: (updates: Record<string, any>) => void;
  onSave: (data?: Record<string, any>) => void;
}

const Step9Questions = ({ formData, updateFormData }: StepProps) => {
  const questions = formData.general_questions || {};
  const setAnswer = (key: string, value: any) => {
    updateFormData({ general_questions: { ...questions, [key]: value } });
  };

  const coverage = formData.coverage_selections || {};
  const hasGL = coverage.general_liability && coverage.general_liability !== "No Coverage";

  const isAnswered = (qId: string, isNumberOnly: boolean) => {
    const q = questions[qId];
    if (!q) return false;
    if (isNumberOnly) return q.value != null && q.value !== "";
    return q.answer === "Yes" || q.answer === "No";
  };

  const YesNoCheckboxes = ({ qId, current }: { qId: string; current: string }) => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`${qId}-yes`}
          checked={current === "Yes"}
          onCheckedChange={(checked) => {
            if (checked) setAnswer(qId, { ...questions[qId], answer: "Yes" });
            else setAnswer(qId, { ...questions[qId], answer: "" });
          }}
        />
        <Label htmlFor={`${qId}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`${qId}-no`}
          checked={current === "No"}
          onCheckedChange={(checked) => {
            if (checked) setAnswer(qId, { ...questions[qId], answer: "No" });
            else setAnswer(qId, { ...questions[qId], answer: "" });
          }}
        />
        <Label htmlFor={`${qId}-no`} className="text-sm font-normal cursor-pointer">No</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 9 — General Questions</h3>
        <p className="text-sm text-muted-foreground font-mono">Answer Yes or No for each question</p>
      </div>

      {/* Auto Liability Questions */}
      <div className="space-y-3">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Auto Liability Questions</Label>
        {AUTO_LIABILITY_QUESTIONS.map((q) => {
          const isNumberOnly = (q as any).hasNumber && !q.hasExplain && !(q as any).hasDate;
          const answered = isAnswered(q.id, isNumberOnly);
          return (
            <div key={q.id} className={`p-3 rounded-md bg-secondary/30 border space-y-2 ${!answered ? "border-destructive/50" : "border-border"}`}>
              <p className="text-sm">{q.text}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {!isNumberOnly && (
                  <YesNoCheckboxes qId={q.id} current={questions[q.id]?.answer || ""} />
                )}
                {q.hasExplain && questions[q.id]?.answer === "Yes" && (
                  <Input
                    className="flex-1 min-w-[200px]"
                    placeholder="Please explain..."
                    value={questions[q.id]?.explanation || ""}
                    onChange={(e) => setAnswer(q.id, { ...questions[q.id], explanation: e.target.value })}
                  />
                )}
                {(q as any).hasDate && questions[q.id]?.answer === "Yes" && (
                  <Input
                    type="date"
                    className="w-40"
                    value={questions[q.id]?.date || ""}
                    onChange={(e) => setAnswer(q.id, { ...questions[q.id], date: e.target.value })}
                  />
                )}
                {(q as any).hasNumber && (
                  <Input
                    type="number"
                    className="w-32"
                    placeholder="0"
                    value={questions[q.id]?.value || ""}
                    onChange={(e) => setAnswer(q.id, { ...questions[q.id], value: e.target.value })}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue & Credit */}
      <div className="space-y-3">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Revenue & Credit</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Total Annual Revenue ($)</Label>
            <Input type="number" value={formData.total_annual_revenue ?? formData.projected_gross_receipts ?? ""} onChange={(e) => updateFormData({ total_annual_revenue: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label>Total Sub-Haul Revenue ($)</Label>
            <Input type="number" value={formData.total_subhaul_revenue ?? ""} onChange={(e) => updateFormData({ total_subhaul_revenue: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
        </div>
      </div>

      {/* GL Questions */}
      {hasGL && (
        <div className="space-y-3">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">General Liability Questions</Label>
          {GL_QUESTIONS.map((q) => {
            const answered = isAnswered(q.id, false);
            return (
              <div key={q.id} className={`p-3 rounded-md bg-secondary/30 border space-y-2 ${!answered ? "border-destructive/50" : "border-border"}`}>
                <p className="text-sm">{q.text}</p>
                <YesNoCheckboxes qId={q.id} current={questions[q.id]?.answer || ""} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Step9Questions;
