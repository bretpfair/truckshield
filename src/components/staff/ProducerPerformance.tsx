import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Users, TrendingUp, Clock, Briefcase } from "lucide-react";
import { differenceInHours, differenceInDays } from "date-fns";

interface ProducerStats {
  userId: string;
  name: string;
  totalAccounts: number;
  boundAccounts: number;
  conversionRate: number;
  avgResponseHours: number | null;
  accountsByStatus: Record<string, number>;
}

const statusOrder = ["pending_info", "info_complete", "quoting", "quoted", "bound"];

const ProducerPerformance = () => {
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: staffProfiles } = useQuery({
    queryKey: ["staff-profiles-performance"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "producer"]);
      if (rolesErr) throw rolesErr;

      const userIds = [...new Set(roles.map((r) => r.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (profErr) throw profErr;

      return roles.map((r) => {
        const p = profiles.find((pr) => pr.user_id === r.user_id);
        return {
          userId: r.user_id,
          role: r.role,
          name: p?.full_name || p?.email || r.user_id.slice(0, 8),
        };
      });
    },
  });

  // Fetch first response times (first activity_log entry per account after creation)
  const { data: activityData } = useQuery({
    queryKey: ["producer-response-times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("account_id, created_at, user_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (!accounts || !staffProfiles) return null;

  // Dedupe staff (a user can have both admin+producer roles)
  const uniqueStaff = Array.from(
    new Map(staffProfiles.map((s) => [s.userId, s])).values()
  );

  // Build per-producer stats
  const producerStats: ProducerStats[] = uniqueStaff.map((staff) => {
    const myAccounts = accounts.filter((a) => a.assigned_producer_id === staff.userId);
    const bound = myAccounts.filter((a) => a.status === "bound").length;
    const total = myAccounts.length;

    // Status breakdown
    const accountsByStatus: Record<string, number> = {};
    statusOrder.forEach((s) => {
      accountsByStatus[s] = myAccounts.filter((a) => a.status === s).length;
    });

    // Avg first-response time: time between account creation and first activity by the producer
    let avgResponseHours: number | null = null;
    if (activityData) {
      const responseTimes: number[] = [];
      myAccounts.forEach((acc) => {
        const firstActivity = activityData.find(
          (a) => a.account_id === acc.id && a.user_id === staff.userId
        );
        if (firstActivity) {
          const hours = differenceInHours(
            new Date(firstActivity.created_at),
            new Date(acc.created_at)
          );
          responseTimes.push(hours);
        }
      });
      if (responseTimes.length > 0) {
        avgResponseHours = Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        );
      }
    }

    return {
      userId: staff.userId,
      name: staff.name,
      totalAccounts: total,
      boundAccounts: bound,
      conversionRate: total > 0 ? Math.round((bound / total) * 100) : 0,
      avgResponseHours,
      accountsByStatus,
    };
  });

  // Sort by total accounts desc
  producerStats.sort((a, b) => b.totalAccounts - a.totalAccounts);

  // Unassigned accounts
  const unassignedCount = accounts.filter((a) => !a.assigned_producer_id).length;

  // Chart data for accounts per producer
  const chartData = producerStats
    .filter((p) => p.totalAccounts > 0)
    .map((p) => ({
      name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
      accounts: p.totalAccounts,
      bound: p.boundAccounts,
    }));

  const formatResponseTime = (hours: number | null) => {
    if (hours === null) return "—";
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active Producers</p>
            </div>
            <p className="text-2xl font-bold">{producerStats.filter((p) => p.totalAccounts > 0).length}</p>
            <p className="text-[10px] text-muted-foreground">{uniqueStaff.length} total staff</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-4 w-4 text-accent" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Avg Book Size</p>
            </div>
            <p className="text-2xl font-bold">
              {producerStats.filter((p) => p.totalAccounts > 0).length > 0
                ? Math.round(
                    accounts.filter((a) => a.assigned_producer_id).length /
                      producerStats.filter((p) => p.totalAccounts > 0).length
                  )
                : 0}
            </p>
            <p className="text-[10px] text-muted-foreground">accounts per producer</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Best Conversion</p>
            </div>
            <p className="text-2xl font-bold text-success">
              {producerStats.length > 0
                ? Math.max(...producerStats.map((p) => p.conversionRate))
                : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {producerStats.find(
                (p) => p.conversionRate === Math.max(...producerStats.map((x) => x.conversionRate))
              )?.name || "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-warning" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Unassigned</p>
            </div>
            <p className="text-2xl font-bold text-warning">{unassignedCount}</p>
            <p className="text-[10px] text-muted-foreground">accounts need assignment</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Accounts per producer chart */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Accounts by Producer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(215, 12%, 52%)" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 52%)" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 18%, 10%)",
                      border: "1px solid hsl(220, 14%, 18%)",
                      borderRadius: "6px",
                      color: "hsl(210, 20%, 92%)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="accounts" name="Total" fill="hsl(195, 100%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bound" name="Bound" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No assigned accounts yet</p>
            )}
          </CardContent>
        </Card>

        {/* Producer leaderboard */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Producer Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {producerStats.length > 0 ? (
              <div className="space-y-3">
                {producerStats.map((producer, idx) => (
                  <div
                    key={producer.userId}
                    className="flex items-center gap-3 p-2 rounded border border-border/50 bg-secondary/30"
                  >
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{producer.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <span>{producer.totalAccounts} accts</span>
                        <span>·</span>
                        <span className="text-success">{producer.conversionRate}% conv</span>
                        <span>·</span>
                        <span className="text-accent">
                          {formatResponseTime(producer.avgResponseHours)} resp
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-success/10 text-success border-success/20"
                      >
                        {producer.boundAccounts} bound
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No producers found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProducerPerformance;
