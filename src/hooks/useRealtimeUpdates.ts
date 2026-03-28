import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on quotes, notifications, and accounts.
 * Invalidates relevant react-query caches on any change.
 */
const useRealtimeUpdates = (userId?: string, accountId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("global-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["client-all-quotes"] });
          queryClient.invalidateQueries({ queryKey: ["client-quote-docs"] });
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["client-accounts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};

export default useRealtimeUpdates;
