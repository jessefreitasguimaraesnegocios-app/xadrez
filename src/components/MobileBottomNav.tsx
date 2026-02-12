import { cn } from "@/lib/utils";
import { LayoutDashboard, Swords, Trophy, Users, Menu } from "lucide-react";
import { useUnreadDirectCount } from "@/hooks/useUnreadDirectCount";
import { useGameInvites } from "@/hooks/useGameInvites";

const navItems = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "play", label: "Jogar", icon: Swords },
  { id: "tournaments", label: "Torneios", icon: Trophy },
  { id: "friends", label: "Amigos", icon: Users },
  { id: "menu", label: "Mais", icon: Menu },
] as const;

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMenuClick: () => void;
  className?: string;
}

export function MobileBottomNav({ activeTab, onTabChange, onMenuClick, className }: MobileBottomNavProps) {
  const unreadCount = useUnreadDirectCount();
  const { receivedPending: gameInvitesReceived } = useGameInvites();
  const gameInvitesCount = gameInvitesReceived.length;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]",
        "h-16 min-h-[56px] px-2 safe-area-inset-bottom",
        className
      )}
    >
      {navItems.map((item) => {
        const isMenu = item.id === "menu";
        const isActive = !isMenu && activeTab === item.id;
        const showFriendsBadge = item.id === "friends" && unreadCount > 0;
        const showPlayBadge = item.id === "play" && gameInvitesCount > 0;
        const showBadge = showFriendsBadge || showPlayBadge;
        const badgeCount = showFriendsBadge ? unreadCount : showPlayBadge ? gameInvitesCount : 0;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => (isMenu ? onMenuClick() : onTabChange(item.id))}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] flex-1 touch-manipulation rounded-lg transition-colors active:bg-muted",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative inline-flex">
              <Icon className="w-6 h-6" />
              {showBadge && (
                <span className="notification-badge absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
