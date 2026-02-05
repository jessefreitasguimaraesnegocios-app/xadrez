import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
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
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "play", label: "Jogar", icon: Swords },
  { id: "tournaments", label: "Torneios", icon: Trophy },
  { id: "friends", label: "Amigos", icon: Users },
  { id: "betting", label: "Apostas", icon: Coins },
];

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { user, profile, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Crown className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl">ChessBet</h1>
            <p className="text-xs text-sidebar-foreground/60">Play & Win</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-sidebar-border">
        {loading ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </div>
        ) : user && profile ? (
          <Link to="/profile" className="block">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors cursor-pointer">
              <Avatar className="w-10 h-10 ring-2 ring-primary">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {profile.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{profile.display_name || profile.username}</p>
                <p className="text-xs text-sidebar-foreground/60">
                  {profile.elo_rating} ELO • {profile.wins}V/{profile.losses}D
                </p>
              </div>
            </div>
          </Link>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/auth')}
          >
            <LogIn className="w-4 h-4" />
            Entrar / Criar Conta
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => onTabChange(item.id)}
            className={cn(
              "w-full justify-start gap-3 h-11 font-medium",
              activeTab === item.id
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Link to="/settings">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Settings className="w-5 h-5" />
            Configurações
          </Button>
        </Link>
        {user && (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
