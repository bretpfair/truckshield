import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Section 9 — General Questions</h3>
        <p className="text-sm text-muted-foreground font-mono">Answer Yes or No for each question</p>
      </div>

      {/* Auto Liability Questions */}
      <div className="space-y-3">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Auto Liability Questions</Label>
        {AUTO_LIABILITY_QUESTIONS.map((q) => (
          <div key={q.id} className="p-3 rounded-md bg-secondary/30 border border-border space-y-2">
            <p className="text-sm">{q.text}</p>
            <div className="flex items-center gap-3">
              <Select value={questions[q.id]?.answer || ""} onValueChange={(v) => setAnswer(q.id, { ...questions[q.id], answer: v })}>
                <SelectTrigger className="w-24"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
              {q.hasExplain && questions[q.id]?.answer === "Yes" && (
                <Input
                  className="flex-1"
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
        ))}
      </div>

      {/* Revenue & Credit */}
      <div className="space-y-3">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Revenue & Credit</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Total Annual Revenue ($)</Label>
            <Input type="number" value={formData.total_annual_revenue || ""} onChange={(e) => updateFormData({ total_annual_revenue: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label>Total Sub-Haul Revenue ($)</Label>
            <Input type="number" value={formData.total_subhaul_revenue || ""} onChange={(e) => updateFormData({ total_subhaul_revenue: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
        </div>
      </div>

      {/* GL Questions */}
      {hasGL && (
        <div className="space-y-3">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">General Liability Questions</Label>
          {GL_QUESTIONS.map((q) => (
            <div key={q.id} className="p-3 rounded-md bg-secondary/30 border border-border space-y-2">
              <p className="text-sm">{q.text}</p>
              <Select value={questions[q.id]?.answer || ""} onValueChange={(v) => setAnswer(q.id, { ...questions[q.id], answer: v })}>
                <SelectTrigger className="w-24"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Step9Questions;
