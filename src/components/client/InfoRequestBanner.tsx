import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfoRequestBannerProps {
  accountId: string;
}

const InfoRequestBanner = ({ accountId }: InfoRequestBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  const { data: pendingRequests } = useQuery({
    queryKey: ["info-requests-banner", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("info_requests")
        .select("*, quotes(carriers(name))")
        .eq("account_id", accountId)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
  });

  if (dismissed || !pendingRequests?.length) return null;

  return (
    <div className="relative rounded-lg border border-warning/40 bg-warning/10 p-3 sm:p-4 animate-fade-in">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1 rounded-md hover:bg-warning/20 transition-colors"
      >
        <X className="h-4 w-4 text-warning" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="rounded-full bg-warning/20 p-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground">Action Required</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingRequests.length === 1
              ? `${(pendingRequests[0] as any)?.quotes?.carriers?.name || "A carrier"} has requested additional information.`
              : `${pendingRequests.length} carriers have requested additional information.`}
          </p>
          <div className="mt-2 space-y-1.5">
            {pendingRequests.slice(0, 3).map((req: any) => (
              <div key={req.id} className="text-xs bg-warning/10 border border-warning/20 rounded px-2 py-1.5">
                <span className="font-medium text-foreground">{req.quotes?.carriers?.name || req.carrier_name}:</span>{" "}
                <span className="text-muted-foreground">{req.request_details}</span>
              </div>
            ))}
            {pendingRequests.length > 3 && (
              <p className="text-[11px] text-muted-foreground font-mono">
                +{pendingRequests.length - 3} more requests
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoRequestBanner;
