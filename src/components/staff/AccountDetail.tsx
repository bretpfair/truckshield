import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ClipboardList, Eye, Download, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateApplicationPdf } from "@/lib/generateApplicationPdf";
import MarketGuidance from "./MarketGuidance";
import SubmittedMarkets from "./SubmittedMarkets";
import ActivityLog from "./ActivityLog";
import InviteClientDialog from "./InviteClientDialog";
import DocumentHub from "./DocumentHub";
import TaskManager from "./TaskManager";
import ApplicationWizard from "@/components/application/ApplicationWizard";


interface Props {
  accountId: string;
  onBack: () => void;
  onPreviewClient?: (accountId: string) => void;
}

const AccountDetail = ({ accountId, onBack, onPreviewClient }: Props) => {
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloseLostDialog, setShowCloseLostDialog] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteAccount = useMutation({
    mutationFn: async () => {
      // Delete related records first, then the account (CASCADE handles most, but explicit for safety)
      const { error } = await supabase.from("accounts").delete().eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Account deleted" });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error deleting account", description: err.message, variant: "destructive" });
    },
  });

  const closeLostAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounts").update({ status: "closed_lost" }).eq("id", accountId);
      if (error) throw error;
      await supabase.from("activity_log").insert({
        account_id: accountId,
        action_type: "status_change",
        description: "Account marked as Closed/Lost",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      toast({ title: "Account marked as Closed/Lost" });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: account } = useQuery({
    queryKey: ["account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile", account?.client_user_id],
    enabled: !!account?.client_user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", account!.client_user_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: carriers } = useQuery({
    queryKey: ["carriers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("carriers").select("*").eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: powerUnits } = useQuery({
    queryKey: ["power_units", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("power_units").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: accountTrailers } = useQuery({
    queryKey: ["trailers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trailers").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: lossHistory } = useQuery({
    queryKey: ["loss_history", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loss_history").select("*").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const { data: garageLocations } = useQuery({
    queryKey: ["garage_locations", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_locations").select("*").eq("account_id", accountId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingQuotes } = useQuery({
    queryKey: ["quotes", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*, carriers(name)").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const markSubmitted = useMutation({
    mutationFn: async ({ carrierId, score }: { carrierId: string; score: number }) => {
      const { error } = await supabase.from("quotes").insert({
        account_id: accountId,
        carrier_id: carrierId,
        match_score: score,
        status: "submitted",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes", accountId] });
      toast({ title: "Marked as submitted" });
    },
  });

  const submittedCarrierIds = existingQuotes?.map((q: any) => q.carrier_id) || [];

  if (!account) return null;

  if (showWizard) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="gap-1.5 text-muted-foreground">
          ← Back to Account
        </Button>
        <ApplicationWizard account={account} />
      </div>
    );
  }

  const infoFields = [
    { label: "DOT#", value: account.dot_number },
    { label: "MC#", value: account.mc_number },
    { label: "Fleet Size", value: account.fleet_size },
    { label: "Years in Business", value: account.years_in_business },
    { label: "Annual Revenue", value: account.annual_revenue ? `$${Number(account.annual_revenue).toLocaleString()}` : null },
    { label: "Cargo Types", value: account.cargo_types?.join(", ") },
    { label: "Operating States", value: account.operating_states?.join(", ") },
    { label: "Claims", value: account.number_of_claims },
    { label: "Loss History", value: account.loss_history_summary },
    { label: "Coverage Expiry", value: account.current_coverage_expiry },
    { label: "Business Type", value: account.business_type },
    { label: "Authority Date", value: account.date_of_authority },
  ];

  const contactFields = [
    { label: "Contact Name", value: clientProfile?.full_name || account.business_owner_name },
    { label: "Email", value: clientProfile?.email || account.contact_email },
    { label: "Phone", value: clientProfile?.phone || account.contact_phone },
    { label: "Mailing Address", value: [account.mailing_address, account.mailing_city, account.mailing_state, account.mailing_zip].filter(Boolean).join(", ") || null },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">{account.company_name}</h2>
        <Badge variant="outline">{account.status.replace(/_/g, " ")}</Badge>
        <div className="flex-1" />
        {account.status !== "closed_lost" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-warning border-warning/30 hover:bg-warning/10"
            onClick={() => setShowCloseLostDialog(true)}
          >
            <XCircle className="h-3.5 w-3.5" /> Close / Lost
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowWizard(true)} className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> View Application
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            generateApplicationPdf({
              account,
              drivers: drivers || [],
              powerUnits: powerUnits || [],
              trailers: accountTrailers || [],
              lossHistory: lossHistory || [],
              garageLocations: garageLocations || [],
            })
          }
        >
          <Download className="h-3.5 w-3.5" /> Download Application
        </Button>
        {onPreviewClient && (
          <Button variant="outline" size="sm" onClick={() => onPreviewClient(accountId)} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview Client
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {/* Account Info with Contact */}
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Contact Info */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Contact Information</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {contactFields.map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground font-mono">{f.label}</p>
                  <p className="text-sm font-medium">{f.value || <span className="text-muted-foreground italic">Missing</span>}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border" />
          {/* Business Info */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Business Information</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {infoFields.map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground font-mono">{f.label}</p>
                  <p className="text-sm font-medium">{f.value || <span className="text-muted-foreground italic">Missing</span>}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submitted Markets - moved up */}
      {existingQuotes && existingQuotes.length > 0 && (
        <SubmittedMarkets accountId={accountId} quotes={existingQuotes} />
      )}

      {/* Market Guidance */}
      {carriers && (
        <MarketGuidance
          account={account}
          carriers={carriers}
          drivers={drivers || []}
          powerUnits={powerUnits || []}
          trailers={accountTrailers || []}
          lossHistory={lossHistory || []}
          onMarkSubmitted={(carrierId, score) => markSubmitted.mutate({ carrierId, score })}
          submittedCarrierIds={submittedCarrierIds}
        />
      )}

      {/* Tasks & Follow-ups */}
      <TaskManager accountId={accountId} />

      {/* Document Hub */}
      <DocumentHub accountId={accountId} />

      {/* Client Invite (if no client linked) */}
      {!account.client_user_id && (
        <InviteClientDialog accountId={accountId} defaultEmail={account.contact_email || ""} />
      )}

      {/* Activity Log & Notes */}
      <ActivityLog accountId={accountId} />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{account.company_name}</strong>? This will remove all associated data including quotes, drivers, vehicles, and documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAccount.mutate()}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close/Lost Confirmation */}
      <AlertDialog open={showCloseLostDialog} onOpenChange={setShowCloseLostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Closed / Lost</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{account.company_name}</strong> from the active pipeline. The record will be preserved but no longer appear in your pipeline view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => closeLostAccount.mutate()}>
              Confirm Close / Lost
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountDetail;
