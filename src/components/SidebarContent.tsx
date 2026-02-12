import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useUnreadDirectCount } from "@/hooks/useUnreadDirectCount";
import { useGameInvites } from "@/hooks/useGameInvites";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Swords,
  Trophy,
  Users,
  Coins,
  Settings,
  LogOut,
  Crown,
  LogIn,
  Wallet,
  Camera,
  Shield,
} from "lucide-react";

export const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "play", label: "Jogar", icon: Swords },
  { id: "wallet", label: "Carteira", icon: Wallet },
  { id: "tournaments", label: "Torneios", icon: Trophy },
  { id: "friends", label: "Amigos", icon: Users },
  { id: "betting", label: "Apostas", icon: Coins },
] as const;

interface SidebarContentProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Chamado após clicar em um item (ex.: fechar sheet no mobile) */
  onItemClick?: () => void;
  /** Se true, usa classes para touch (maior altura dos itens) */
  touchFriendly?: boolean;
}

export function SidebarContent({ activeTab, onTabChange, onItemClick, touchFriendly }: SidebarContentProps) {
  const { user, profile, signOut, loading } = useAuth();
  const { balance_available } = useWallet();
  const { count: unreadDirectCount, refetch: refetchUnread } = useUnreadDirectCount();
  const { receivedPending: gameInvitesReceived } = useGameInvites();
  const gameInvitesCount = gameInvitesReceived.length;
  const { handleAvatarUpload, uploading } = useAvatarUpload();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isWalletPage = pathname === "/wallet";
  const isAdminPage = pathname === "/admin";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
    onItemClick?.();
  };

  const handleNav = (itemId: string) => {
    if (itemId === "wallet") {
      navigate("/wallet");
    } else if (pathname === "/") {
      onTabChange(itemId);
      if (itemId === "friends") refetchUnread();
    } else {
      navigate("/", { state: { tab: itemId } });
      if (itemId === "friends") refetchUnread();
    }
    onItemClick?.();
  };

  const btnClass = touchFriendly ? "h-12 min-h-[48px]" : "h-11";

  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar">
      <div className={cn("shrink-0", touchFriendly ? "p-4" : "p-6", "border-b border-sidebar-border")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary shrink-0">
            <Crown className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl">ChessBet</h1>
            <p className="text-xs text-sidebar-foreground/60">Play & Win</p>
          </div>
        </div>
      </div>

      <div className={cn("shrink-0 p-4", "border-b border-sidebar-border")}>
        {loading ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </div>
        ) : user && profile ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
              <div className="relative shrink-0">
                <Avatar className="w-10 h-10 ring-2 ring-primary">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                    {profile.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity"
                  title="Alterar foto"
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </label>
              </div>
              <Link to="/profile" className="flex-1 min-w-0" onClick={onItemClick}>
                <p className="font-medium text-sm truncate">{profile.display_name || profile.username}</p>
                <p className="text-xs text-sidebar-foreground/60">
                  {profile.elo_rating} ELO • {profile.wins}V {profile.draws}E {profile.losses}D
                </p>
              </Link>
            </div>
            <Link
              to="/wallet"
              className="block px-3 py-2 text-xs font-medium text-accent hover:underline"
              onClick={onItemClick}
            >
              Saldo: R$ {Number(balance_available).toFixed(2)}
            </Link>
          </div>
        ) : (
          <Button
            variant="outline"
            className={cn("w-full gap-2", touchFriendly && "h-12")}
            onClick={() => {
              navigate("/auth");
              onItemClick?.();
            }}
          >
            <LogIn className="w-4 h-4" />
            Entrar / Criar Conta
          </Button>
        )}
      </div>

      <nav className={cn("flex-1 min-h-0 overflow-y-auto p-4 space-y-1", touchFriendly && "space-y-0.5")}>
        {menuItems.map((item) => {
          const isActive = item.id === "wallet" ? isWalletPage : activeTab === item.id;
          return (
            <div key={item.id}>
              {item.id === "wallet" ? (
                touchFriendly ? (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 font-medium",
                      btnClass,
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                    onClick={() => {
                      onItemClick?.();
                      navigate("/wallet");
                    }}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </Button>
                ) : (
                  <Link to="/wallet" onClick={() => onItemClick?.()}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 font-medium",
                        btnClass,
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {item.label}
                    </Button>
                  </Link>
                )
              ) : (
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 font-medium relative",
                    btnClass,
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  onClick={() => handleNav(item.id)}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === "play" && gameInvitesCount > 0 && (
                    <span className="notification-badge min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                      {gameInvitesCount > 99 ? "99+" : gameInvitesCount}
                    </span>
                  )}
                  {item.id === "friends" && Number(unreadDirectCount) > 0 && (
                    <span className="notification-badge min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                      {unreadDirectCount > 99 ? "99+" : unreadDirectCount}
                    </span>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </nav>

      <div className={cn("shrink-0 p-4 border-t border-sidebar-border space-y-1", touchFriendly && "space-y-0.5")}>
        {profile?.is_admin && (
          <Link to="/admin" onClick={onItemClick}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 font-medium",
                btnClass,
                isAdminPage
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Shield className="w-5 h-5" />
              Administração
            </Button>
          </Link>
        )}
        <Link to="/settings" onClick={onItemClick}>
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent", btnClass)}
          >
            <Settings className="w-5 h-5" />
            Configurações
          </Button>
        </Link>
        {user && (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn("w-full justify-start gap-3 text-destructive hover:bg-destructive/10", btnClass)}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        )}
      </div>
    </div>
  );
}
