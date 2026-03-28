import { Shield, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, parseISO } from "date-fns";

interface PolicyRenewalCardProps {
  currentCoverageExpiry: string | null;
}

const PolicyRenewalCard = ({ currentCoverageExpiry }: PolicyRenewalCardProps) => {
  if (!currentCoverageExpiry) return null;

  const expiryDate = parseISO(currentCoverageExpiry);
  const today = new Date();
  const daysRemaining = differenceInDays(expiryDate, today);
  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining <= 30 && daysRemaining >= 0;

  return (
    <Card className={`glass-panel ${isUrgent ? "border-warning/40" : isExpired ? "border-destructive/40" : "border-success/30"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Policy Status</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              isExpired
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : isUrgent
                ? "bg-warning/10 text-warning border-warning/20"
                : "bg-success/10 text-success border-success/20"
            }
          >
            {isExpired ? "Expired" : isUrgent ? "Renewal Soon" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                {isExpired ? "Expired On" : "Expires On"}
              </p>
              <p className="text-sm font-semibold text-foreground">{format(expiryDate, "MMMM d, yyyy")}</p>
            </div>
          </div>
          {!isExpired && (
            <div className="flex items-center gap-2">
              <div
                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-2 ${
                  isUrgent ? "border-warning bg-warning/10" : "border-success bg-success/10"
                }`}
              >
                <span className={`text-sm sm:text-base font-bold ${isUrgent ? "text-warning" : "text-success"}`}>
                  {daysRemaining}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">days remaining</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PolicyRenewalCard;
