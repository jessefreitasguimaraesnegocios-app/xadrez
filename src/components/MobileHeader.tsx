import { Button } from "@/components/ui/button";
import { Crown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  onMenuClick: () => void;
  className?: string;
}

export function MobileHeader({ onMenuClick, className }: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 safe-area-inset-top",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-lg truncate">ChessBet</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 touch-manipulation"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="w-6 h-6" />
      </Button>
    </header>
  );
}
