import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus(data?.success ? "success" : "error");
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full glass-panel">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Verifying...</p>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="h-10 w-10 text-warning mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Unsubscribe</h2>
              <p className="text-muted-foreground text-sm">
                Are you sure you want to unsubscribe from emails? You will no longer receive app notifications via email.
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive" className="mt-2">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Unsubscribe
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Unsubscribed</h2>
              <p className="text-muted-foreground text-sm">You have been unsubscribed from future emails.</p>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Already Unsubscribed</h2>
              <p className="text-muted-foreground text-sm">This email address has already been unsubscribed.</p>
            </>
          )}
          {(status === "invalid" || status === "error") && (
            <>
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">
                {status === "invalid" ? "Invalid Link" : "Something Went Wrong"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {status === "invalid"
                  ? "This unsubscribe link is invalid or has expired."
                  : "Please try again later."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
