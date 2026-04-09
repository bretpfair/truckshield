import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { TrendingUp, CalendarClock, AlertTriangle, Activity, UserCheck, Send } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import ProducerPerformance from "./ProducerPerformance";

const statusOrder = ["pending_info", "info_complete", "quoting", "quoted", "bound"];
const statusLabels: Record<string, string> = {
  pending_info: "Pending Info",
  info_complete: "Info Complete",
  quoting: "Quoting",
  quoted: "Quoted",
  bound: "Bound",
};
const statusChartColors: Record<string, string> = {
  pending_info: "hsl(38, 92%, 50%)",
  info_complete: "hsl(195, 100%, 50%)",
  quoting: "hsl(195, 90%, 40%)",
  quoted: "hsl(142, 76%, 36%)",
  bound: "hsl(142, 76%, 46%)",
};

const DashboardAnalytics = () => {
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "open")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*, accounts(company_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: invitations } = useQuery({
    queryKey: ["client-invitations-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_invitations")
        .select("id, status, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  if (!accounts) return null;

  // Client adoption metrics
  const totalInvites = invitations?.length || 0;
  const acceptedInvites = invitations?.filter((i) => i.status === "accepted").length || 0;
  const pendingInvites = invitations?.filter((i) => i.status === "pending").length || 0;
  const expiredInvites = totalInvites - acceptedInvites - pendingInvites;
  const adoptionRate = totalInvites > 0 ? ((acceptedInvites / totalInvites) * 100).toFixed(0) : "0";

  // Funnel data
  const funnelData = statusOrder.map((status) => ({
    name: statusLabels[status],
    value: accounts.filter((a) => a.status === status).length,
    fill: statusChartColors[status],
  }));

  // Conversion rates
  const totalAccounts = accounts.length;
  const boundCount = accounts.filter((a) => a.status === "bound").length;
  const conversionRate = totalAccounts > 0 ? ((boundCount / totalAccounts) * 100).toFixed(1) : "0";

  // Accounts created last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30);
  const newAccountsCount = accounts.filter((a) => isAfter(new Date(a.created_at), thirtyDaysAgo)).length;

  // Overdue tasks
  const overdueTasks = tasks?.filter((t) => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    return due < new Date() && due.toDateString() !== new Date().toDateString();
  }) || [];

  // Tasks due today
  const todayTasks = tasks?.filter((t) => {
    if (!t.due_date) return false;
    return new Date(t.due_date).toDateString() === new Date().toDateString();
  }) || [];

  return (
    <div className="space-y-4">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Conversion Rate</p>
            </div>
            <p className="text-2xl font-bold text-success">{conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground">{boundCount} bound of {totalAccounts} total</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">New (30d)</p>
            </div>
            <p className="text-2xl font-bold">{newAccountsCount}</p>
            <p className="text-[10px] text-muted-foreground">accounts added this month</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-warning" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Due Today</p>
            </div>
            <p className="text-2xl font-bold text-warning">{todayTasks.length}</p>
            <p className="text-[10px] text-muted-foreground">tasks need attention</p>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Overdue</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p>
            <p className="text-[10px] text-muted-foreground">tasks past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Adoption + Funnel + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Client Adoption */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Client Adoption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Accepted", value: acceptedInvites, fill: "hsl(142, 76%, 36%)" },
                      { name: "Pending", value: pendingInvites, fill: "hsl(38, 92%, 50%)" },
                      { name: "Expired", value: expiredInvites > 0 ? expiredInvites : 0, fill: "hsl(215, 12%, 30%)" },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={44}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                <div className="text-center mb-2">
                  <p className="text-2xl font-bold">{adoptionRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-mono">adoption rate</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Send className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Sent</span>
                    </div>
                    <span className="font-mono font-medium">{totalInvites}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="h-3 w-3 text-success" />
                      <span className="text-muted-foreground">Accepted</span>
                    </div>
                    <span className="font-mono font-medium text-success">{acceptedInvites}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3 text-warning" />
                      <span className="text-muted-foreground">Pending</span>
                    </div>
                    <span className="font-mono font-medium text-warning">{pendingInvites}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11, fill: "hsl(215, 12%, 52%)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 14%, 18%)",
                    borderRadius: "6px",
                    color: "hsl(210, 20%, 92%)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <span>{(activity as any).accounts?.company_name}</span>
                        <span>·</span>
                        <span>{format(new Date(activity.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks List */}
      {overdueTasks.length > 0 && (
        <Card className="glass-panel border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2 rounded border border-destructive/10 bg-destructive/5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-[10px] text-destructive font-mono">
                      Due {format(new Date(task.due_date!), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 bg-destructive/10 text-destructive border-destructive/20">
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Producer Performance */}
      <ProducerPerformance />
    </div>
  );
};

export default DashboardAnalytics;
