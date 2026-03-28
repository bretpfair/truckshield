import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast as sonnerToast } from "sonner";
import { sendClientInvite } from "@/lib/sendClientInvite";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AccountDetail from "@/components/staff/AccountDetail";
import CarrierManager from "@/components/staff/CarrierManager";
import InviteClientDialog from "@/components/staff/InviteClientDialog";
import InviteStaffDialog from "@/components/staff/InviteStaffDialog";
import PdfUpload from "@/components/staff/PdfUpload";
import PipelineView from "@/components/staff/PipelineView";
import StaffManager from "@/components/staff/StaffManager";
import DashboardAnalytics from "@/components/staff/DashboardAnalytics";
import {
  Building2, Users, FileText, TrendingUp, Plus, Search, Upload, LayoutGrid, List, BarChart3, Loader2, AlertTriangle,
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
  navigateToAccountId?: string | null;
  onNavigateHandled?: () => void;
}

const StaffDashboard = ({ onPreviewClient, onOpenMessages, navigateToAccountId, onNavigateHandled }: StaffDashboardProps = {}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountMode, setNewAccountMode] = useState<"dot" | "manual">("dot");
  const [newDotNumber, setNewDotNumber] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isDotLookingUp, setIsDotLookingUp] = useState(false);
  const [dotLookupResult, setDotLookupResult] = useState<Record<string, any> | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle external navigation from notification clicks
  useEffect(() => {
    if (navigateToAccountId) {
      setSelectedAccountId(navigateToAccountId);
      onNavigateHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateToAccountId]);

  // Sync selected account to messaging sidebar
  useEffect(() => {
    if (selectedAccountId) {
      onOpenMessages?.(selectedAccountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);
  

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
    mutationFn: async (accountData: Record<string, any>) => {
      const { data, error } = await supabase.from("accounts").insert({
        company_name: accountData.company_name || "New Account",
        created_by: user!.id,
        assigned_producer_id: user!.id,
        ...accountData,
      }).select().single();
      if (error) throw error;
      return { account: data, hadEmail: !!accountData.contact_email };
    },
    onSuccess: async ({ account: newAccount, hadEmail }) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      resetNewAccountForm();
      toast({ title: "Account created" });

      // Auto-invite if contact_email was included
      if (hadEmail && newAccount.contact_email) {
        try {
          const result = await sendClientInvite({
            accountId: newAccount.id,
            email: newAccount.contact_email,
            invitedBy: user?.id,
            companyName: newAccount.company_name,
          });
          if (result.sent) sonnerToast.success("Client invite auto-sent", { description: result.message });
        } catch { /* non-fatal */ }
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetNewAccountForm = () => {
    setShowNewAccount(false);
    setNewAccountMode("dot");
    setNewDotNumber("");
    setNewCompanyName("");
    setDotLookupResult(null);
  };

  const handleDotLookup = async () => {
    const dot = newDotNumber.trim();
    if (!dot) return;
    setIsDotLookingUp(true);
    setDotLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("fmcsa-lookup", {
        body: { dotNumber: dot },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Lookup failed");

      const c = data.data;
      const accountData: Record<string, any> = { dot_number: dot };
      if (c.company_name) accountData.company_name = c.company_name;
      if (c.dba_name) accountData.dba_name = c.dba_name;
      if (c.mc_number) accountData.mc_number = c.mc_number;
      if (c.mailing_address) accountData.mailing_address = c.mailing_address;
      if (c.mailing_city) accountData.mailing_city = c.mailing_city;
      if (c.mailing_state) accountData.mailing_state = c.mailing_state;
      if (c.mailing_zip) accountData.mailing_zip = c.mailing_zip;
      if (c.contact_phone) accountData.contact_phone = c.contact_phone;
      if (c.contact_email) accountData.contact_email = c.contact_email;
      if (c.total_trucks != null) accountData.total_trucks = c.total_trucks;
      if (c.total_drivers != null) accountData.total_drivers = c.total_drivers;

      // Map FMCSA cargo carried to commodity_info
      if (Array.isArray(c.cargo_carried) && c.cargo_carried.length > 0) {
        const COMMODITY_OPTIONS = [
          "Agricultural/Farm Supplies", "Beverages", "Building Materials", "Chemicals",
          "Coal/Coke", "Commodities Dry Bulk", "Construction", "Dirt / Sand / Gravel",
          "Drive/Tow away", "Fresh Produce", "Garbage/Refuse", "General Freight",
          "Grain, Feed, Hay", "Household Goods", "Intermodal Cont.", "Liquids/Gases",
          "Livestock", "Logs, Poles, Beams, Lumber", "Machinery, Large Objects", "Meat",
          "Metal: sheets, coils, rolls", "Mobile Homes", "Motor Vehicles", "Oilfield Equipment",
          "Paper Products", "Passengers", "Refrigerated Food", "US Mail", "Utilities",
          "Water Well", "Other",
        ];
        // Normalize for matching
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        const optionMap = new Map(COMMODITY_OPTIONS.map((o) => [normalize(o), o]));

        const matched: string[] = [];
        for (const raw of c.cargo_carried as string[]) {
          const norm = normalize(raw);
          // Direct match or partial match
          const exact = optionMap.get(norm);
          if (exact) {
            matched.push(exact);
          } else {
            // Try partial matching
            for (const [key, val] of optionMap) {
              if (norm.includes(key) || key.includes(norm)) {
                if (!matched.includes(val)) matched.push(val);
                break;
              }
            }
          }
        }

        if (matched.length > 0) {
          const pctEach = Math.floor(100 / matched.length);
          const remainder = 100 - pctEach * matched.length;
          const selected: Record<string, string> = {};
          matched.forEach((m, i) => {
            selected[m] = String(pctEach + (i === 0 ? remainder : 0));
          });
          accountData.commodity_info = { selected_commodities: selected };
          accountData.cargo_types = matched;
        }
      }

      setDotLookupResult(accountData);
    } catch (err: any) {
      console.error("DOT lookup error:", err);
      sonnerToast.error("DOT Lookup Failed", { description: err.message || "Could not retrieve carrier data" });
    } finally {
      setIsDotLookingUp(false);
    }
  };

  const handleConfirmDotCreate = () => {
    if (!dotLookupResult) return;
    const dot = dotLookupResult.dot_number;
    const existing = accounts?.find((a) => a.dot_number === dot);
    if (existing) {
      sonnerToast.warning(`Duplicate DOT# ${dot}`, {
        description: `An account for "${existing.company_name}" already exists with this DOT number.`,
        action: {
          label: "View Account",
          onClick: () => { resetNewAccountForm(); setSelectedAccountId(existing.id); },
        },
        duration: 8000,
      });
      return;
    }
    createAccount.mutate(dotLookupResult);
    const fieldCount = Object.keys(dotLookupResult).length - 1;
    sonnerToast.success(`Imported ${fieldCount} fields from SAFER for ${dotLookupResult.company_name || "DOT " + dot}`);
  };

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
          {isAdmin && <TabsTrigger value="carriers">Carriers</TabsTrigger>}
          {isAdmin && (
            <TabsTrigger value="analytics">
              <BarChart3 className="h-3 w-3 mr-1" /> Analytics
            </TabsTrigger>
          )}
          <TabsTrigger value="invite">Invite Client</TabsTrigger>
          {isAdmin && <TabsTrigger value="invite-staff">Invite Staff</TabsTrigger>}
          {isAdmin && <TabsTrigger value="staff-manage">Staff Management</TabsTrigger>}
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
              <CardContent className="p-4 space-y-3">
                {newAccountMode === "dot" && !dotLookupResult ? (
                  <>
                    <p className="text-sm font-semibold">Enter DOT Number to auto-fill from SAFER</p>
                    <div className="flex gap-3">
                      <Input
                        placeholder="DOT Number (e.g. 1234567)"
                        value={newDotNumber}
                        onChange={(e) => setNewDotNumber(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && newDotNumber.trim() && handleDotLookup()}
                      />
                      <Button onClick={handleDotLookup} disabled={!newDotNumber.trim() || isDotLookingUp}>
                        {isDotLookingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                        {isDotLookingUp ? "Looking up..." : "Lookup DOT"}
                      </Button>
                      <Button variant="ghost" onClick={resetNewAccountForm}>Cancel</Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewAccountMode("manual")}
                      className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                    >
                      No DOT or Manual Entry
                    </button>
                  </>
                ) : newAccountMode === "dot" && dotLookupResult ? (
                  (() => {
                    const normalizedDot = dotLookupResult.dot_number?.replace(/\D/g, "");
                    const existingAccount = accounts?.find((a) => a.dot_number?.replace(/\D/g, "") === normalizedDot);
                    return (
                      <>
                        <p className="text-sm font-semibold">SAFER Lookup Results — DOT# {dotLookupResult.dot_number}</p>
                        {existingAccount && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                              An account for <strong>"{existingAccount.company_name}"</strong> already exists with this DOT number.
                            </span>
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                                onClick={async () => {
                                  try {
                                    const { dot_number, ...updateFields } = dotLookupResult;
                                    const { error } = await supabase
                                      .from("accounts")
                                      .update(updateFields)
                                      .eq("id", existingAccount.id);
                                    if (error) throw error;
                                    queryClient.invalidateQueries({ queryKey: ["accounts"] });
                                    const fieldCount = Object.keys(updateFields).length;
                                    sonnerToast.success(`Updated ${fieldCount} fields on "${existingAccount.company_name}" from SAFER`);
                                    resetNewAccountForm();
                                    setSelectedAccountId(existingAccount.id);
                                  } catch (err: any) {
                                    sonnerToast.error("Update failed", { description: err.message });
                                  }
                                }}
                              >
                                Update from SAFER
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border-warning/30 text-warning hover:bg-warning/10"
                                onClick={() => { resetNewAccountForm(); setSelectedAccountId(existingAccount.id); }}
                              >
                                View Account
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm bg-secondary/50 rounded-lg p-4 border border-border">
                          {[
                            { label: "Company Name", value: dotLookupResult.company_name },
                            { label: "DBA", value: dotLookupResult.dba_name },
                            { label: "MC Number", value: dotLookupResult.mc_number },
                            { label: "Address", value: [dotLookupResult.mailing_address, dotLookupResult.mailing_city, dotLookupResult.mailing_state, dotLookupResult.mailing_zip].filter(Boolean).join(", ") },
                            { label: "Phone", value: dotLookupResult.contact_phone },
                            { label: "Email", value: dotLookupResult.contact_email },
                            { label: "Power Units", value: dotLookupResult.total_trucks },
                            { label: "Drivers", value: dotLookupResult.total_drivers },
                            { label: "Cargo Carried", value: dotLookupResult.cargo_types?.join(", ") },
                          ]
                            .filter((f) => f.value)
                            .map((f) => (
                              <div key={f.label}>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{f.label}</span>
                                <p className="font-medium truncate">{f.value}</p>
                              </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          {!existingAccount && (
                            <Button onClick={handleConfirmDotCreate}>
                              <Plus className="h-4 w-4 mr-2" /> Create Account
                            </Button>
                          )}
                          <Button variant="outline" onClick={() => setDotLookupResult(null)}>
                            ← New Lookup
                          </Button>
                          <Button variant="ghost" onClick={resetNewAccountForm}>Cancel</Button>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <p className="text-sm font-semibold">Manual Account Creation</p>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Company name"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && newCompanyName && createAccount.mutate({ company_name: newCompanyName })}
                      />
                      <Button onClick={() => createAccount.mutate({ company_name: newCompanyName })} disabled={!newCompanyName}>
                        Create
                      </Button>
                      <Button variant="ghost" onClick={resetNewAccountForm}>Cancel</Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewAccountMode("dot")}
                      className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                    >
                      ← Back to DOT Lookup
                    </button>
                  </>
                )}
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

        {isAdmin && (
          <TabsContent value="carriers">
            <CarrierManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="analytics">
            <DashboardAnalytics />
          </TabsContent>
        )}

        <TabsContent value="invite">
          <InviteClientDialog />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invite-staff">
            <InviteStaffDialog />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="staff-manage">
            <StaffManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default StaffDashboard;
