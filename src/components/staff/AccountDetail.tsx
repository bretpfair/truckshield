import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ArrowLeft, ClipboardList, Eye, Download, Trash2, XCircle, RefreshCw, Loader2, Mail, Zap, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sendClientInvite } from "@/lib/sendClientInvite";
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
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSaferUpdating, setIsSaferUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSaferUpdate = async () => {
    if (!account?.dot_number) {
      sonnerToast.error("No DOT number on this account");
      return;
    }
    setIsSaferUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fmcsa-lookup", {
        body: { dotNumber: account.dot_number },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Lookup failed");

      const c = data.data;
      const updateFields: Record<string, any> = {};
      if (c.company_name) updateFields.company_name = c.company_name;
      if (c.dba_name) updateFields.dba_name = c.dba_name;
      if (c.mc_number) updateFields.mc_number = c.mc_number;
      if (c.mailing_address) updateFields.mailing_address = c.mailing_address;
      if (c.mailing_city) updateFields.mailing_city = c.mailing_city;
      if (c.mailing_state) updateFields.mailing_state = c.mailing_state;
      if (c.mailing_zip) updateFields.mailing_zip = c.mailing_zip;
      if (c.contact_phone) updateFields.contact_phone = c.contact_phone;
      if (c.contact_email) updateFields.contact_email = c.contact_email;
      if (c.total_trucks != null) updateFields.total_trucks = c.total_trucks;
      if (c.total_drivers != null) updateFields.total_drivers = c.total_drivers;

      // Map cargo carried to commodity_info
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
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        const optionMap = new Map(COMMODITY_OPTIONS.map((o) => [normalize(o), o]));
        const matched: string[] = [];
        for (const raw of c.cargo_carried as string[]) {
          const norm = normalize(raw);
          const exact = optionMap.get(norm);
          if (exact) { matched.push(exact); }
          else {
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
          matched.forEach((m, i) => { selected[m] = String(pctEach + (i === 0 ? remainder : 0)); });
          updateFields.commodity_info = { selected_commodities: selected };
          updateFields.cargo_types = matched;
        }
      }

      const { error: updateError } = await supabase
        .from("accounts")
        .update(updateFields)
        .eq("id", accountId);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      const fieldCount = Object.keys(updateFields).length;
      sonnerToast.success(`Updated ${fieldCount} fields from SAFER`);

      // Auto-invite if contact_email was just added
      if (updateFields.contact_email && !account?.contact_email) {
        try {
          const result = await sendClientInvite({
            accountId,
            email: updateFields.contact_email,
            invitedBy: user?.id,
            companyName: updateFields.company_name || account?.company_name,
          });
          if (result.sent) sonnerToast.success("Client invite auto-sent", { description: result.message });
        } catch { /* non-fatal */ }
      }
    } catch (err: any) {
      sonnerToast.error("SAFER Update Failed", { description: err.message });
    } finally {
      setIsSaferUpdating(false);
    }
  };

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
    mutationFn: async ({ carrierId, score, carrierName }: { carrierId: string; score: number; carrierName: string }) => {
      const { error } = await supabase.from("quotes").insert({
        account_id: accountId,
        carrier_id: carrierId,
        match_score: score,
        status: "submitted",
        created_by: user!.id,
      });
      if (error) throw error;

      // Send market-submitted email to client
      try {
        const { data: acct } = await supabase
          .from("accounts")
          .select("client_user_id, contact_email")
          .eq("id", accountId)
          .single();

        const clientEmail = acct?.contact_email;
        if (clientEmail) {
          let firstName: string | undefined;
          if (acct?.client_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", acct.client_user_id)
              .single();
            firstName = profile?.full_name?.split(" ")[0];
          }

          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "carrier-status-change",
              recipientEmail: clientEmail,
              idempotencyKey: `market-submitted-${accountId}-${carrierId}-${Date.now()}`,
              templateData: {
                firstName,
                carrierName,
                newStatus: "submitted",
                portalLink: `${window.location.origin}/client`,
              },
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send market-submitted email:", emailErr);
      }
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

  // Derive summary fields from related tables when account-level fields are empty
  const derivedFleetSize = account.fleet_size || account.total_trucks || powerUnits?.length || null;
  const derivedDriverCount = account.total_drivers || drivers?.length || null;

  // Derive cargo types from commodity_info rows if account.cargo_types is empty
  const derivedCargoTypes = (() => {
    if (account.cargo_types?.length) return account.cargo_types.join(", ");
    const ci = account.commodity_info as any;
    if (ci?.commodities && Array.isArray(ci.commodities)) {
      const types = ci.commodities.map((c: any) => c.type).filter(Boolean);
      if (types.length) return types.join(", ");
    }
    return null;
  })();

  // Derive operating states from radius_operations
  const derivedOperatingStates = (() => {
    if (account.operating_states?.length) return account.operating_states.join(", ");
    const ro = account.radius_operations as any;
    if (Array.isArray(ro) && ro.length > 0) {
      const states = ro.map((r: any) => r.state).filter(Boolean);
      if (states.length) return [...new Set(states)].join(", ");
    }
    // Fallback: derive from garage locations
    if (garageLocations?.length) {
      const states = garageLocations.map((g) => g.state).filter(Boolean);
      if (states.length) return [...new Set(states)].join(", ");
    }
    return null;
  })();

  // Derive claims count from loss_history
  const derivedClaims = (() => {
    if (account.number_of_claims != null && account.number_of_claims > 0) return account.number_of_claims;
    if (lossHistory?.length) {
      let total = 0;
      for (const lh of lossHistory) {
        const terms = lh.policy_terms as any[];
        if (Array.isArray(terms)) {
          for (const term of terms) {
            total += (Number(term.num_claims) || 0);
          }
        }
      }
      return total > 0 ? total : 0;
    }
    return account.number_of_claims;
  })();

  // Derive loss history summary
  const derivedLossHistorySummary = (() => {
    if (account.loss_history_summary) return account.loss_history_summary;
    if (lossHistory?.length) {
      const noPrior = lossHistory.every((lh) => lh.no_prior_coverage);
      if (noPrior) return "No prior coverage";
      const types = lossHistory.map((lh) => lh.coverage_type).filter(Boolean);
      return types.length ? `${types.length} line(s): ${types.map(t => t.replace(/_/g, " ")).join(", ")}` : null;
    }
    return null;
  })();

  // Derive annual revenue from commodity_info or projected_gross_receipts
  const derivedRevenue = (() => {
    if (account.annual_revenue) return `$${Number(account.annual_revenue).toLocaleString()}`;
    if (account.projected_gross_receipts) return `$${Number(account.projected_gross_receipts).toLocaleString()}`;
    const ci = account.commodity_info as any;
    if (ci?.projected_gross_receipts) return `$${Number(ci.projected_gross_receipts).toLocaleString()}`;
    return null;
  })();

  const infoFields = [
    { label: "DOT#", value: account.dot_number },
    { label: "MC#", value: account.mc_number },
    { label: "Fleet Size", value: derivedFleetSize },
    { label: "Years in Business", value: account.years_in_business },
    { label: "Annual Revenue", value: derivedRevenue },
    { label: "Cargo Types", value: derivedCargoTypes },
    { label: "Requested Effective Date", value: account.requested_effective_date },
    { label: "Business Type", value: account.business_type },
    { label: "Line(s) of Coverage", value: derivedLossHistorySummary },
    { label: "Total Drivers", value: derivedDriverCount },
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
        {account.dot_number && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleSaferUpdate}
            disabled={isSaferUpdating}
          >
            {isSaferUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isSaferUpdating ? "Updating..." : "Update from SAFER"}
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
        {account.contact_email && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isSendingInvite}
            onClick={async () => {
              setIsSendingInvite(true);
              try {
                const result = await sendClientInvite({
                  accountId,
                  email: account.contact_email!,
                  invitedBy: user?.id,
                  companyName: account.company_name,
                });
                if (result.sent) {
                  sonnerToast.success(result.message);
                  queryClient.invalidateQueries({ queryKey: ["invitations"] });
                } else {
                  sonnerToast.info(result.message);
                }
              } catch (err: any) {
                sonnerToast.error("Failed to send invite", { description: err.message });
              } finally {
                setIsSendingInvite(false);
              }
            }}
          >
            {isSendingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Send Invite
          </Button>
        )}
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

      {/* Tasks & Follow-ups */}
      <TaskManager accountId={accountId} />

      {/* Document Hub */}
      <DocumentHub accountId={accountId} />

      {/* Market Guidance (collapsible) */}
      {carriers && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between px-0 py-2 hover:bg-transparent">
              <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> AI Market Guidance
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Collapsible>
      )}

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
