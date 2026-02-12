import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Trophy, Medal } from "lucide-react";

interface PlayerCardProps {
  name: string;
  avatar?: string;
  rating: number;
  rank: number;
  wins: number;
  losses: number;
  draws?: number;
  isOnline?: boolean;
  variant?: "default" | "compact";
}

const PlayerCard = ({
  name,
  avatar,
  rating,
  rank,
  wins,
  losses,
  draws = 0,
  isOnline = false,
  variant = "default",
}: PlayerCardProps) => {
  const getRankIcon = () => {
    if (rank === 1) return <Crown className="w-5 h-5 text-rank-gold" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-rank-silver" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-rank-bronze" />;
    return <span className="text-muted-foreground font-bold">#{rank}</span>;
  };

  const getRankColor = () => {
    if (rank === 1) return "rank-gold";
    if (rank === 2) return "rank-silver";
    if (rank === 3) return "rank-bronze";
    return "text-muted-foreground";
  };

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 p-2 rounded-lg bg-card hover:bg-secondary transition-colors">
        <div className="relative">
          <Avatar className="w-8 h-8">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-bet-win rounded-full border-2 border-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{rating} ELO</p>
        </div>
        {getRankIcon()}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-14 h-14 ring-2 ring-primary/20">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-bet-win rounded-full border-2 border-card" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-lg">{name}</h3>
            {getRankIcon()}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="secondary" className="font-mono">
              {rating} ELO
            </Badge>
            <span className="text-sm text-bet-win">{wins}V</span>
            <span className="text-sm text-muted-foreground">{draws}E</span>
            <span className="text-sm text-bet-lose">{losses}D</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
