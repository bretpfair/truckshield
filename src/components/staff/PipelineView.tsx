import { useState, useRef, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, MessageSquare, GripVertical, Filter, AlertTriangle,
  CheckSquare, ArrowRightLeft, Clock, X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays } from "date-fns";

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
  updated_at?: string;
  created_at?: string;
}

interface Props {
  accounts: Account[];
  onSelectAccount: (id: string) => void;
}

const STALE_DAYS = 7;

const PipelineView = ({ accounts: rawAccounts, onSelectAccount }: Props) => {
  const accounts = rawAccounts.filter((a) => a.status !== "closed_lost");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragAccountId = useRef<string | null>(null);
  const dragSourceStatus = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [staleFilter, setStaleFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quote submissions per account for carrier badges
  const { data: quotesByAccount } = useQuery({
    queryKey: ["pipeline-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("account_id, status, carriers(name)")
        .in("status", ["submitted", "reviewing", "info_requested", "quoted", "bound", "declined"]);
      if (error) throw error;
      const map: Record<string, { name: string; status: string }[]> = {};
      data?.forEach((q: any) => {
        if (!map[q.account_id]) map[q.account_id] = [];
        map[q.account_id].push({ name: q.carriers?.name ?? "Unknown", status: q.status });
      });
      return map;
    },
  });

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

  // Activity dates for stale detection
  const { data: lastActivityMap } = useQuery({
    queryKey: ["last-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("account_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((a: any) => {
        if (!map[a.account_id]) map[a.account_id] = a.created_at;
      });
      return map;
    },
  });

  const isStale = (account: Account) => {
    const lastActivity = lastActivityMap?.[account.id] || account.updated_at || account.created_at;
    if (!lastActivity) return false;
    return differenceInDays(new Date(), new Date(lastActivity)) >= STALE_DAYS;
  };

  // Filter accounts
  let filteredAccounts = accounts;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredAccounts = filteredAccounts.filter(
      (a) => a.company_name.toLowerCase().includes(q) || a.dot_number?.toLowerCase().includes(q)
    );
  }
  if (statusFilter !== "all") {
    filteredAccounts = filteredAccounts.filter((a) => a.status === statusFilter);
  }
  if (staleFilter) {
    filteredAccounts = filteredAccounts.filter(isStale);
  }

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

  // Bulk actions
  const bulkMoveStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        const { error } = await supabase.from("accounts").update({ status: newStatus }).eq("id", id);
        if (error) throw error;
        const account = accounts.find((a) => a.id === id);
        const label = pipelineColumns.find((c) => c.key === newStatus)?.label ?? newStatus;
        await supabase.from("activity_log").insert({
          account_id: id,
          action_type: "status_change",
          description: `${account?.company_name ?? "Account"} bulk-moved to ${label}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} accounts updated` });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: DragEvent, accountId: string, currentStatus: string) => {
    dragAccountId.current = accountId;
    dragSourceStatus.current = currentStatus;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", accountId);
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    dragAccountId.current = null;
    dragSourceStatus.current = null;
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  };

  const handleDragLeave = (e: DragEvent, colKey: string) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (dragOverCol === colKey) setDragOverCol(null);
    }
  };

  const handleDrop = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const accountId = dragAccountId.current;
    if (!accountId || dragSourceStatus.current === colKey) return;
    moveAccount.mutate({ accountId, newStatus: colKey });
  };

  const carrierStatusColor: Record<string, string> = {
    submitted: "bg-primary/15 text-primary",
    reviewing: "bg-warning/15 text-warning",
    info_requested: "bg-warning/15 text-warning",
    quoted: "bg-success/15 text-success",
    bound: "bg-success/20 text-success",
    declined: "bg-destructive/15 text-destructive",
  };

  const staleCount = accounts.filter(isStale).length;

  return (
    <div className="space-y-3">
      {/* Toolbar: filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3 w-3" />
          Filters
          {(statusFilter !== "all" || staleFilter) && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {(statusFilter !== "all" ? 1 : 0) + (staleFilter ? 1 : 0)}
            </span>
          )}
        </Button>

        {staleCount > 0 && (
          <Button
            variant={staleFilter ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setStaleFilter(!staleFilter)}
          >
            <AlertTriangle className="h-3 w-3" />
            {staleCount} Stale ({STALE_DAYS}+ days)
          </Button>
        )}

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground font-mono">{selectedIds.size} selected</span>
            <Select onValueChange={(val) => bulkMoveStatus.mutate(val)}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Bulk move to..." />
              </SelectTrigger>
              <SelectContent>
                {pipelineColumns.map((col) => (
                  <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {pipelineColumns.map((col) => (
                  <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Search company/DOT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[200px] text-xs"
          />
          {(statusFilter !== "all" || searchQuery || staleFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setStatusFilter("all"); setSearchQuery(""); setStaleFilter(false); }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pipeline columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[400px]">
        {pipelineColumns.map((col) => {
          const colAccounts = filteredAccounts.filter((a) => a.status === col.key);
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
                    const carriers = quotesByAccount?.[account.id] ?? [];
                    const accountIsStale = isStale(account);
                    const isSelected = selectedIds.has(account.id);

                    return (
                      <HoverCard key={account.id} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <Card
                            className={`cursor-grab active:cursor-grabbing transition-colors bg-card ${
                              isSelected ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/30"
                            } ${accountIsStale ? "border-l-2 border-l-warning" : ""}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, account.id, col.key)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onSelectAccount(account.id)}
                          >
                            <CardContent className="p-2.5 sm:p-3">
                              <div className="flex items-start gap-1.5">
                                <div
                                  className="mt-0.5 shrink-0"
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(account.id); }}
                                >
                                  <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                </div>
                                <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <p className="font-semibold text-sm truncate">{account.company_name}</p>
                                    {accountIsStale && (
                                      <Clock className="h-3 w-3 text-warning shrink-0" title={`No activity in ${STALE_DAYS}+ days`} />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                    {account.dot_number && <span>DOT# {account.dot_number}</span>}
                                    {account.fleet_size && <span>{account.fleet_size} trucks</span>}
                                  </div>
                                  {/* Carrier submission badges */}
                                  {carriers.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-1.5">
                                      {carriers.slice(0, 3).map((c, i) => (
                                        <span
                                          key={i}
                                          className={`text-[9px] font-mono px-1 py-0.5 rounded ${carrierStatusColor[c.status] ?? "bg-muted text-muted-foreground"}`}
                                          title={`${c.name}: ${c.status}`}
                                        >
                                          {c.name.split(" ")[0]}
                                        </span>
                                      ))}
                                      {carriers.length > 3 && (
                                        <span className="text-[9px] font-mono px-1 py-0.5 text-muted-foreground">
                                          +{carriers.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
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
                              {account.dot_number && <span>DOT# {account.dot_number}</span>}
                              {account.fleet_size && <span>{account.fleet_size} trucks</span>}
                              {account.business_owner_name && <span className="col-span-2">Owner: {account.business_owner_name}</span>}
                              {account.cargo_types && account.cargo_types.length > 0 && (
                                <span className="col-span-2">Cargo: {account.cargo_types.slice(0, 3).join(", ")}</span>
                              )}
                              {account.current_coverage_expiry && (
                                <span className="col-span-2">Expiry: {account.current_coverage_expiry}</span>
                              )}
                            </div>
                            {carriers.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-mono uppercase text-muted-foreground">Carriers</p>
                                {carriers.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span>{c.name}</span>
                                    <Badge variant="outline" className={`text-[9px] h-4 ${carrierStatusColor[c.status] ?? ""}`}>
                                      {c.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                            {msgCount > 0 && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <MessageSquare className="h-3 w-3" />
                                {msgCount} client message{msgCount !== 1 ? "s" : ""}
                              </div>
                            )}
                            {accountIsStale && (
                              <div className="flex items-center gap-1 text-xs text-warning">
                                <AlertTriangle className="h-3 w-3" />
                                No activity in {STALE_DAYS}+ days
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
    </div>
  );
};

export default PipelineView;
