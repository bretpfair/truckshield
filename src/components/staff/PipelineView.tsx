import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const pipelineColumns = [
  { key: "lead", label: "Lead", color: "text-muted-foreground" },
  { key: "pending_info", label: "Pending Info", color: "text-warning" },
  { key: "info_complete", label: "Info Complete", color: "text-primary" },
  { key: "quoting", label: "Quoting", color: "text-accent" },
  { key: "quoted", label: "Quoted", color: "text-success" },
  { key: "bound", label: "Bound", color: "text-success" },
];

const statusColors: Record<string, string> = {
  lead: "bg-muted/50 border-muted-foreground/10",
  pending_info: "bg-warning/5 border-warning/15",
  info_complete: "bg-primary/5 border-primary/15",
  quoting: "bg-accent/5 border-accent/15",
  quoted: "bg-success/5 border-success/15",
  bound: "bg-success/10 border-success/20",
};

interface Account {
  id: string;
  company_name: string;
  dot_number?: string | null;
  fleet_size?: number | null;
  status: string;
}

interface Props {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
}

const PipelineView = ({ accounts, onSelectAccount }: Props) => {
  return (
    <div className="grid grid-cols-6 gap-3 min-h-[400px]">
      {pipelineColumns.map((col) => {
        const colAccounts = accounts.filter((a) => a.status === col.key);
        return (
          <div key={col.key} className="flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className={`text-xs font-mono uppercase tracking-wider ${col.color}`}>
                {col.label}
              </span>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {colAccounts.length}
              </Badge>
            </div>
            <ScrollArea className={`flex-1 rounded-lg border p-2 ${statusColors[col.key] ?? "bg-secondary/30 border-border"}`}>
              <div className="space-y-2">
                {colAccounts.map((account) => (
                  <Card
                    key={account.id}
                    className="cursor-pointer hover:border-primary/30 transition-colors bg-card"
                    onClick={() => onSelectAccount(account.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{account.company_name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                            {account.dot_number && <span>DOT# {account.dot_number}</span>}
                            {account.fleet_size && <span>{account.fleet_size} trucks</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {colAccounts.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-mono">Empty</p>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineView;
