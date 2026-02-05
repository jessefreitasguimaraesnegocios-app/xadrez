import TournamentCard from "./TournamentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockTournaments = [
  {
    id: 1,
    name: "Grande Prêmio Brasil",
    participants: 48,
    maxParticipants: 64,
    prizePool: 5000,
    entryFee: 50,
    startTime: "Hoje, 20:00",
    status: "open" as const,
    format: "Eliminação Simples • Blitz",
  },
  {
    id: 2,
    name: "Torneio Semanal",
    participants: 32,
    maxParticipants: 32,
    prizePool: 1500,
    entryFee: 25,
    startTime: "Em andamento",
    status: "in_progress" as const,
    format: "Suíço • Rápida",
  },
  {
    id: 3,
    name: "Arena Noturna",
    participants: 24,
    maxParticipants: 128,
    prizePool: 2000,
    entryFee: 10,
    startTime: "Amanhã, 21:00",
    status: "open" as const,
    format: "Arena • Bullet",
  },
  {
    id: 4,
    name: "Campeonato Mensal",
    participants: 64,
    maxParticipants: 64,
    prizePool: 10000,
    entryFee: 100,
    startTime: "Finalizado",
    status: "finished" as const,
    format: "Eliminação Dupla • Clássica",
  },
];

const TournamentList = () => {
  const openTournaments = mockTournaments.filter((t) => t.status === "open");
  const inProgressTournaments = mockTournaments.filter((t) => t.status === "in_progress");
  const finishedTournaments = mockTournaments.filter((t) => t.status === "finished");

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-2xl">Torneios</h2>
      
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="open">Abertos ({openTournaments.length})</TabsTrigger>
          <TabsTrigger value="progress">Em andamento ({inProgressTournaments.length})</TabsTrigger>
          <TabsTrigger value="finished">Finalizados ({finishedTournaments.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="open">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              {openTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="progress">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              {inProgressTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="finished">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              {finishedTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentList;
