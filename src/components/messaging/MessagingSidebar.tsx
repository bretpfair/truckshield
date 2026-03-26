import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MessageSquare } from "lucide-react";
import AccountMessages from "./AccountMessages";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  isStaff: boolean;
}

const MessagingSidebar = ({ open, onOpenChange, accountId, isStaff }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            Messages
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden p-4">
          {accountId ? (
            <AccountMessages accountId={accountId} isStaff={isStaff} embedded />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">No account selected</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MessagingSidebar;
