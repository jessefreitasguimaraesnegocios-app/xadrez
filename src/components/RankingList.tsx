import { useState, useEffect } from "react";
import PlayerCard from "./PlayerCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  is_online: boolean;
};

interface RankingListProps {
  variant?: "full" | "compact";
  limit?: number;
}

const RankingList = ({ variant = "full", limit = 10 }: RankingListProps) => {
  const [players, setPlayers] = useState<(ProfileRow & { rank: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const query = supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, elo_rating, wins, losses, draws, is_online")
        .order("elo_rating", { ascending: false })
        .limit(limit ?? 50);

      const { data, error } = await query;
      if (error) {
        setPlayers([]);
        setLoading(false);
        return;
      }
      setPlayers(
        (data ?? []).map((p, i) => ({ ...(p as ProfileRow), rank: i + 1 }))
      );
      setLoading(false);
    };
    load();
  }, [limit]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl">Ranking Global</h2>
        {limit && (
          <button className="text-sm text-primary hover:underline">Ver todos</button>
        )}
      </div>
      <ScrollArea className={variant === "compact" ? "h-[300px]" : "h-[500px]"}>
        <div className="space-y-2 pr-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Carregando...</p>
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum jogador no ranking.</p>
          ) : (
            players.map((player) => (
              <PlayerCard
                key={player.user_id}
                name={player.display_name || player.username}
                avatar={player.avatar_url ?? undefined}
                rating={player.elo_rating}
                rank={player.rank}
                wins={player.wins}
                losses={player.losses}
                draws={player.draws ?? 0}
                isOnline={player.is_online}
                variant={variant === "compact" ? "compact" : "default"}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RankingList;
