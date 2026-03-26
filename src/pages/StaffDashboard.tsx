import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AccountDetail from "@/components/staff/AccountDetail";
import CarrierManager from "@/components/staff/CarrierManager";
import InviteClient from "@/components/staff/InviteClient";
import PdfUpload from "@/components/staff/PdfUpload";
import PipelineView from "@/components/staff/PipelineView";
import {
  Building2, Users, FileText, TrendingUp, Plus, Search, Upload, LayoutGrid, List,
} from "lucide-react";

const statusColors: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending_info: "bg-warning/10 text-warning border-warning/20",
  info_complete: "bg-primary/10 text-primary border-primary/20",
  quoting: "bg-accent/10 text-accent border-accent/20",
  quoted: "bg-success/10 text-success border-success/20",
  bound: "bg-success/20 text-success border-success/30",
  declined: "bg-destructive/10 text-destructive border-destructive/20",
};

interface StaffDashboardProps {
  onPreviewClient?: (accountId: string) => void;
  onOpenMessages?: (accountId: string) => void;
}

const StaffDashboard = ({ onPreviewClient, onOpenMessages }: StaffDashboardProps = {}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createAccount = useMutation({
    mutationFn: async (companyName: string) => {
      const { error } = await supabase.from("accounts").insert({
        company_name: companyName,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setShowNewAccount(false);
      setNewCompanyName("");
      toast({ title: "Account created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = accounts?.filter((a) =>
    a.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.dot_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: accounts?.length ?? 0,
    pending: accounts?.filter((a) => a.status === "pending_info").length ?? 0,
    quoting: accounts?.filter((a) => ["quoting", "quoted"].includes(a.status)).length ?? 0,
    bound: accounts?.filter((a) => a.status === "bound").length ?? 0,
  };

  if (selectedAccountId) {
    return (
      <AccountDetail
        accountId={selectedAccountId}
        onBack={() => setSelectedAccountId(null)}
        onPreviewClient={onPreviewClient}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts", value: stats.total, icon: Building2, color: "text-foreground" },
          { label: "Pending Info", value: stats.pending, icon: Users, color: "text-warning" },
          { label: "In Quoting", value: stats.quoting, icon: FileText, color: "text-primary" },
          { label: "Bound", value: stats.bound, icon: TrendingUp, color: "text-success" },
        ].map((s) => (
          <Card key={s.label} className="glass-panel">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="pdf-upload">
            <Upload className="h-3 w-3 mr-1" /> PDF Import
          </TabsTrigger>
          <TabsTrigger value="carriers">Carriers</TabsTrigger>
          <TabsTrigger value="invite">Invite Client</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company or DOT#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center border rounded-md bg-secondary">
              <Button
                variant={viewMode === "pipeline" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode("pipeline")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setShowNewAccount(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Account
            </Button>
          </div>

          {showNewAccount && (
            <Card className="glass-panel">
              <CardContent className="p-4 flex gap-3">
                <Input
                  placeholder="Company name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={() => createAccount.mutate(newCompanyName)} disabled={!newCompanyName}>
                  Create
                </Button>
                <Button variant="ghost" onClick={() => setShowNewAccount(false)}>Cancel</Button>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <p className="text-muted-foreground text-sm font-mono">Loading accounts...</p>
          ) : viewMode === "pipeline" ? (
            <PipelineView
              accounts={filtered ?? []}
              onSelectAccount={setSelectedAccountId}
            />
          ) : (
            <div className="space-y-2">
              {filtered?.map((account) => (
                <Card
                  key={account.id}
                  className="glass-panel cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{account.company_name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                          {account.dot_number && <span>DOT# {account.dot_number}</span>}
                          {account.fleet_size && <span>{account.fleet_size} trucks</span>}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusColors[account.status] ?? ""}>
                      {account.status.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {filtered?.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">No accounts found</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdf-upload">
          <PdfUpload />
        </TabsContent>

        <TabsContent value="carriers">
          <CarrierManager />
        </TabsContent>

        <TabsContent value="invite">
          <InviteClient />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffDashboard;
