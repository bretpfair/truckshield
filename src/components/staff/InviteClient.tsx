import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

const InviteClient = () => {
  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, company_name").is("client_user_id", null);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="glass-panel max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Invite Client
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Clients self-register at the login page. Once registered, you can assign their user to an account
          by updating the account's <code className="font-mono text-primary">client_user_id</code> field.
        </p>
        <p className="text-sm text-muted-foreground">
          Share the portal URL with clients so they can create an account and fill in their details.
        </p>

        <div className="p-3 rounded-md bg-secondary/50 font-mono text-sm break-all">
          {window.location.origin}/auth
        </div>

        <div className="space-y-2">
          <Label>Unassigned Accounts</Label>
          {accounts?.length ? (
            <ul className="text-sm space-y-1">
              {accounts.map((a) => (
                <li key={a.id} className="text-muted-foreground">• {a.company_name}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">All accounts have clients assigned.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InviteClient;
