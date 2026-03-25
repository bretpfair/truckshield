import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText } from "lucide-react";
import ApplicationWizard from "@/components/application/ApplicationWizard";

const ClientPortal = () => {
  const { user } = useAuth();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["client-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, carriers(name)")
        .eq("status", "published");
      if (error) throw error;
      return data;
    },
  });

  const account = accounts?.[0];

  if (isLoading) {
    return <p className="text-muted-foreground font-mono text-sm">Loading your account...</p>;
  }

  if (!account) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No Account Found</h2>
        <p className="text-muted-foreground">
          Your account hasn't been set up yet. Please contact your insurance representative
          to link your account to this portal.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">{account.company_name}</h2>
        <p className="text-muted-foreground text-sm font-mono">Complete your application to receive quotes</p>
      </div>

      <ApplicationWizard account={account} />

      {/* Published Quotes */}
      {quotes && quotes.length > 0 && (
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Your Quotes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotes.map((q: any) => (
              <div key={q.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                <div>
                  <p className="font-medium">{q.carriers?.name ?? "Carrier"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground font-mono mt-1">
                    {q.premium_estimate && <span>Premium: ${Number(q.premium_estimate).toLocaleString()}</span>}
                    {q.published_at && <span>Published: {new Date(q.published_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success">Available</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientPortal;
