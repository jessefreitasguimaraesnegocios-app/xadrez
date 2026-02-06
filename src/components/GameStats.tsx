import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const GameStats = () => {
  const { profile } = useAuth();

  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const draws = profile?.draws ?? 0;
  const total = wins + losses + draws;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const stats = [
    {
      label: "Vitórias",
      value: wins,
      icon: TrendingUp,
      color: "text-bet-win",
      bg: "bg-bet-win/10",
    },
    {
      label: "Derrotas",
      value: losses,
      icon: TrendingDown,
      color: "text-bet-lose",
      bg: "bg-bet-lose/10",
    },
    {
      label: "Taxa de Vitória",
      value: `${winRate}%`,
      icon: Target,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Partidas",
      value: total,
      icon: Gamepad2,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default GameStats;
