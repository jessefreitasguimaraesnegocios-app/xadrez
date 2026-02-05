import PlayerCard from "./PlayerCard";
import { ScrollArea } from "@/components/ui/scroll-area";

const mockPlayers = [
  { id: 1, name: "MagnusCarlsen", rating: 2847, rank: 1, wins: 342, losses: 45, isOnline: true },
  { id: 2, name: "HikaruNakamura", rating: 2789, rank: 2, wins: 298, losses: 67, isOnline: true },
  { id: 3, name: "FabianoCaruana", rating: 2766, rank: 3, wins: 256, losses: 78, isOnline: false },
  { id: 4, name: "DingLiren", rating: 2754, rank: 4, wins: 234, losses: 89, isOnline: true },
  { id: 5, name: "IanNepomniachtchi", rating: 2745, rank: 5, wins: 212, losses: 92, isOnline: false },
  { id: 6, name: "AlirezzaFirouzja", rating: 2738, rank: 6, wins: 198, losses: 87, isOnline: true },
  { id: 7, name: "WesleySo", rating: 2732, rank: 7, wins: 187, losses: 95, isOnline: false },
  { id: 8, name: "AnishGiri", rating: 2720, rank: 8, wins: 176, losses: 101, isOnline: true },
];

interface RankingListProps {
  variant?: "full" | "compact";
  limit?: number;
}

const RankingList = ({ variant = "full", limit }: RankingListProps) => {
  const players = limit ? mockPlayers.slice(0, limit) : mockPlayers;

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
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              name={player.name}
              rating={player.rating}
              rank={player.rank}
              wins={player.wins}
              losses={player.losses}
              isOnline={player.isOnline}
              variant={variant === "compact" ? "compact" : "default"}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RankingList;
