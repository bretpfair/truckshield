import { useState, useRef, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MessageSquare, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useToast } from "@/hooks/use-toast";

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
  business_owner_name?: string | null;
  cargo_types?: string[] | null;
  current_coverage_expiry?: string | null;
}

interface Props {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
}

const PipelineView = ({ accounts: rawAccounts, onSelectAccount }: Props) => {
  const accounts = rawAccounts.filter((a) => a.status !== "closed_lost");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragAccountId = useRef<string | null>(null);
  const dragSourceStatus = useRef<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messageCounts } = useQuery({
    queryKey: ["message-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("account_id")
        .eq("is_staff", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((m: any) => {
        counts[m.account_id] = (counts[m.account_id] || 0) + 1;
      });
      return counts;
    },
  });

  const moveAccount = useMutation({
    mutationFn: async ({ accountId, newStatus }: { accountId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("accounts")
        .update({ status: newStatus })
        .eq("id", accountId);
      if (error) throw error;
      const account = accounts.find((a) => a.id === accountId);
      const label = pipelineColumns.find((c) => c.key === newStatus)?.label ?? newStatus;
      await supabase.from("activity_log").insert({
        account_id: accountId,
        action_type: "status_change",
        description: `${account?.company_name ?? "Account"} moved to ${label}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Account moved" });
    },
    onError: (err: any) => {
      toast({ title: "Error moving account", description: err.message, variant: "destructive" });
    },
  });

  const handleDragStart = (e: DragEvent, accountId: string, currentStatus: string) => {
    dragAccountId.current = accountId;
    dragSourceStatus.current = currentStatus;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", accountId);
    // Add a slight delay to allow the drag image to render
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleDragEnd = (e: DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    dragAccountId.current = null;
    dragSourceStatus.current = null;
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDragLeave = (e: DragEvent, colKey: string) => {
    // Only clear if actually leaving the column (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (dragOverCol === colKey) {
        setDragOverCol(null);
      }
    }
  };

  const handleDrop = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const accountId = dragAccountId.current;
    if (!accountId || dragSourceStatus.current === colKey) return;
    moveAccount.mutate({ accountId, newStatus: colKey });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[400px]">
      {pipelineColumns.map((col) => {
        const colAccounts = accounts.filter((a) => a.status === col.key);
        const isOver = dragOverCol === col.key;
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
            <ScrollArea
              className={`flex-1 rounded-lg border p-2 transition-colors duration-150 ${
                statusColors[col.key] ?? "bg-secondary/30 border-border"
              } ${isOver ? "ring-2 ring-primary/50 border-primary/40" : ""}`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="space-y-2">
                {colAccounts.map((account) => {
                  const msgCount = messageCounts?.[account.id] || 0;
                  return (
                    <HoverCard key={account.id} openDelay={400} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <Card
                          className="cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors bg-card"
                          draggable
                          onDragStart={(e) => handleDragStart(e, account.id, col.key)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onSelectAccount(account.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{account.company_name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {account.dot_number && <span>DOT# {account.dot_number}</span>}
                                  {account.fleet_size && <span>{account.fleet_size} trucks</span>}
                                </div>
                              </div>
                              {msgCount > 0 && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <MessageSquare className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-bold text-primary">{msgCount}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64 text-sm" side="right" align="start">
                        <div className="space-y-2">
                          <p className="font-semibold">{account.company_name}</p>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground font-mono">
                            {account.dot_number && (
                              <span>DOT# {account.dot_number}</span>
                            )}
                            {account.fleet_size && (
                              <span>{account.fleet_size} trucks</span>
                            )}
                            {account.business_owner_name && (
                              <span className="col-span-2">Owner: {account.business_owner_name}</span>
                            )}
                            {account.cargo_types && account.cargo_types.length > 0 && (
                              <span className="col-span-2">Cargo: {account.cargo_types.slice(0, 3).join(", ")}</span>
                            )}
                            {account.current_coverage_expiry && (
                              <span className="col-span-2">Expiry: {account.current_coverage_expiry}</span>
                            )}
                          </div>
                          {msgCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <MessageSquare className="h-3 w-3" />
                              {msgCount} client message{msgCount !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
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
