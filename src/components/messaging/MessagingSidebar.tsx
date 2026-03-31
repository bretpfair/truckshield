import { MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountMessages from "./AccountMessages";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface Props {
  expanded: boolean;
  onToggle: () => void;
  accountId: string | null;
  isStaff: boolean;
}

const MessagingSidebar = ({ expanded, onToggle, accountId, isStaff }: Props) => {
  const isMobile = useIsMobile();

  const messageContent = accountId ? (
    <AccountMessages accountId={accountId} isStaff={isStaff} embedded />
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <MessageSquare className="h-8 w-8 opacity-40 mb-2" />
      <p className="text-sm text-center">Select an account to view messages</p>
    </div>
  );

  /* ── Mobile: bottom drawer ── */
  if (isMobile) {
    return (
      <>
        {/* Floating trigger button */}
        <Button
          variant="default"
          size="icon"
          onClick={onToggle}
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>

        <Drawer open={expanded} onOpenChange={(open) => { if (!open) onToggle(); }}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-4 w-4 text-primary" />
                Messages
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-hidden p-3 min-h-[50vh]">
              {messageContent}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  /* ── Desktop: fixed sidebar ── */
  return (
    <aside
      className={cn(
        "fixed right-0 top-14 h-[calc(100vh-3.5rem)] border-l border-border bg-card/95 backdrop-blur-sm flex flex-col transition-all duration-300 z-40",
        expanded ? "w-[380px]" : "w-12"
      )}
    >
      {/* Toggle header */}
      <div className={cn(
        "h-14 border-b border-border flex items-center shrink-0",
        expanded ? "px-4 justify-between" : "justify-center"
      )}>
        {expanded && (
          <span className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            Messages
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
          {expanded ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>

      {/* Collapsed icon strip */}
      {!expanded && (
        <div className="flex flex-col items-center pt-3">
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8" title="Open Messages">
            <MessageSquare className="h-4 w-4 text-primary" />
          </Button>
        </div>
      )}

      {/* Content */}
      {expanded && (
        <div className="flex-1 overflow-hidden p-3">
          {messageContent}
        </div>
      )}
    </aside>
  );
};

export default MessagingSidebar;
