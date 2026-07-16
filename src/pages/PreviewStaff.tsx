import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Building2, Users, FileText, TrendingUp, Plus, Search,
  Upload, Truck, Eye,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending_info: "bg-warning/10 text-warning border-warning/20",
  info_complete: "bg-primary/10 text-primary border-primary/20",
  quoting: "bg-accent/10 text-accent border-accent/20",
  quoted: "bg-success/10 text-success border-success/20",
  bound: "bg-success/20 text-success border-success/30",
  declined: "bg-destructive/10 text-destructive border-destructive/20",
};

const MOCK_ACCOUNTS = [
  {
    id: "1",
    company_name: "Ekall's Express LLC",
    dot_number: "4217593",
    fleet_size: 8,
    status: "quoting",
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "2",
    company_name: "Summit Freight Inc",
    dot_number: "3891247",
    fleet_size: 22,
    status: "pending_info",
    created_at: "2026-03-18T00:00:00Z",
  },
  {
    id: "3",
    company_name: "Pacific Haulers Corp",
    dot_number: "5012384",
    fleet_size: 5,
    status: "bound",
    created_at: "2026-02-10T00:00:00Z",
  },
  {
    id: "4",
    company_name: "Mountain Ridge Transport",
    dot_number: "4783201",
    fleet_size: 14,
    status: "quoted",
    created_at: "2026-03-20T00:00:00Z",
  },
  {
    id: "5",
    company_name: "Cascade Logistics LLC",
    dot_number: "3564789",
    fleet_size: 3,
    status: "pending_info",
    created_at: "2026-03-24T00:00:00Z",
  },
  {
    id: "6",
    company_name: "Redwood Carriers",
    dot_number: "4921056",
    fleet_size: 11,
    status: "info_complete",
    created_at: "2026-03-12T00:00:00Z",
  },
  {
    id: "7",
    company_name: "Delta Trucking Services",
    dot_number: null,
    fleet_size: null,
    status: "declined",
    created_at: "2026-01-28T00:00:00Z",
  },
];

const PreviewStaff = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = MOCK_ACCOUNTS.filter(
    (a) =>
      a.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.dot_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: MOCK_ACCOUNTS.length,
    pending: MOCK_ACCOUNTS.filter((a) => a.status === "pending_info").length,
    quoting: MOCK_ACCOUNTS.filter((a) => ["quoting", "quoted"].includes(a.status)).length,
    bound: MOCK_ACCOUNTS.filter((a) => a.status === "bound").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">TruckShield</span>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Preview</Badge>
            <span className="status-badge bg-primary/10 text-primary rounded">Staff</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
              <Eye className="h-3 w-3" />
              Preview Client
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Preview banner */}
        <div className="mb-6">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong>Preview Mode</strong> — This is a read-only demo of the staff dashboard with sample data.
              </p>
            </CardContent>
          </Card>
        </div>

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
                <Button disabled>
                  <Plus className="h-4 w-4 mr-2" /> New Account
                </Button>
              </div>

              <div className="space-y-2">
                {filtered.map((account) => (
                  <Card
                    key={account.id}
                    className="glass-panel cursor-pointer hover:border-primary/30 transition-colors"
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
                {filtered.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">No accounts found</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pdf-upload">
              <Card className="glass-panel">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  PDF Import is disabled in preview mode.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="carriers">
              <Card className="glass-panel">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  Carrier management is disabled in preview mode.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invite">
              <Card className="glass-panel">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  Client invitations are disabled in preview mode.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default PreviewStaff;
