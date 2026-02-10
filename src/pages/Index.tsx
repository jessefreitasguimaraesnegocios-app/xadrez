import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SidebarContent } from "@/components/SidebarContent";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import GameStats from "@/components/GameStats";
import DashboardTournaments from "@/components/DashboardTournaments";
import RankingList from "@/components/RankingList";
import FriendsList from "@/components/FriendsList";
import QuickPlay from "@/components/QuickPlay";
import PlayVsBot from "@/components/PlayVsBot";
import TournamentList from "@/components/TournamentList";
import GameView from "@/components/GameView";
import BettingPanel from "@/components/BettingPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotDifficulty } from "@/lib/chess";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { profile, user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const tab = (location.state as { tab?: string } | null)?.tab;
    if (tab && ["dashboard", "play", "tournaments", "friends", "betting"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.state]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameViewGameOver, setGameViewGameOver] = useState(false);
  const [isBotGame, setIsBotGame] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty | null>(null);
  const [botTimeControl, setBotTimeControl] = useState<number>(600);
  const [botPlayerColor, setBotPlayerColor] = useState<"white" | "black">("white");
  const [gameKey, setGameKey] = useState(0);
  const [matchmakingGameId, setMatchmakingGameId] = useState<string | null>(null);

  const handleStartGame = (gameId?: string | null) => {
    setIsBotGame(false);
    setBotDifficulty(null);
    setGameKey((k) => k + 1);
    setMatchmakingGameId(gameId ?? null);
    setGameViewGameOver(false);
    setIsPlaying(true);
    setActiveTab("play");
  };

  // Abre a partida para quem enviou o convite quando o outro aceita (INSERT em games com este usuário como jogador)
  useEffect(() => {
    if (!user?.id) return;
    const onGameCreated = (payload: { new: { id: string } }) => {
      const gameId = payload?.new?.id;
      if (gameId) handleStartGame(gameId);
    };
    const chWhite = supabase
      .channel("games-i-am-white")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "games", filter: `white_player_id=eq.${user.id}` }, onGameCreated)
      .subscribe();
    const chBlack = supabase
      .channel("games-i-am-black")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "games", filter: `black_player_id=eq.${user.id}` }, onGameCreated)
      .subscribe();
    return () => {
      supabase.removeChannel(chWhite);
      supabase.removeChannel(chBlack);
    };
  }, [user?.id]);

  const handleStartBotGame = (difficulty: BotDifficulty, timeControlSeconds: number, playerColor: "white" | "black") => {
    setIsBotGame(true);
    setBotDifficulty(difficulty);
    setBotTimeControl(timeControlSeconds);
    setBotPlayerColor(playerColor);
    setGameKey((k) => k + 1);
    setGameViewGameOver(false);
    setIsPlaying(true);
    setActiveTab("play");
  };

  const handleExitBotGame = () => {
    setIsPlaying(false);
    setIsBotGame(false);
    setBotDifficulty(null);
  };

  const hideBottomNav = isPlaying && !gameViewGameOver;
  const mainContent = (
    <main
      className={
        isMobile
          ? cn("flex-1 p-4 overflow-auto min-h-0 safe-area-inset-bottom", !hideBottomNav && "pb-24")
          : "flex-1 p-6 overflow-auto"
      }
    >
        {activeTab === "dashboard" && (
          <div className={cn("space-y-4 md:space-y-6 max-w-7xl mx-auto", isMobile && "space-y-4")}>
            <div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl mb-1 sm:mb-2 truncate">
                Bem-vindo{profile ? `, ${profile.display_name || profile.username}` : ''}!
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">Pronto para uma partida?</p>
            </div>

            <GameStats />

            <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6", isMobile && "gap-4")}>
              <div className="lg:col-span-2 space-y-4 lg:space-y-6">
                <Card className={cn("bg-card border-border", isMobile ? "p-4" : "p-6")}>
                  <QuickPlay onStartGame={handleStartGame} />
                </Card>
                
                <DashboardTournaments />
              </div>

              <div className={cn("space-y-4 lg:space-y-6", isMobile && "space-y-4")}>
                <Card className={cn("bg-card border-border", isMobile ? "p-4" : "p-6")}>
                  <RankingList variant="compact" limit={5} />
                </Card>
                <Card className={cn("bg-card border-border", isMobile ? "p-4" : "p-6")}>
                  <FriendsList onStartGame={handleStartGame} />
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === "play" && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="font-display font-bold text-3xl mb-2">Jogar</h1>
              <p className="text-muted-foreground">Escolha seu modo de jogo ou continue sua partida</p>
            </div>
            
            {isPlaying ? (
              <div className="space-y-4">
                {isBotGame && (
                  <Button variant="outline" size="sm" onClick={handleExitBotGame} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao menu
                  </Button>
                )}
                <GameView
                  key={gameKey}
                  gameId={matchmakingGameId}
                  withBetting={!isBotGame}
                  isBotGame={isBotGame}
                  botDifficulty={botDifficulty}
                  botPlayerColor={isBotGame ? botPlayerColor : undefined}
                  timeControl={isBotGame ? botTimeControl : undefined}
                  onGameOverChange={setGameViewGameOver}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="p-6 bg-card border-border">
                    <QuickPlay onStartGame={handleStartGame} />
                  </Card>
                  <Card className="p-6 bg-card border-border">
                    <PlayVsBot onStartGame={handleStartBotGame} />
                  </Card>
                </div>
                <Card className="p-6 bg-card border-border">
                  <FriendsList onStartGame={handleStartGame} />
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === "tournaments" && (
          <div className="max-w-7xl mx-auto">
            <TournamentList />
          </div>
        )}

        {activeTab === "friends" && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="font-display font-bold text-3xl mb-2">Amigos</h1>
              <p className="text-muted-foreground">Gerencie seus amigos e convide para partidas</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 bg-card border-border">
                <FriendsList onStartGame={handleStartGame} />
              </Card>
              <Card className="p-6 bg-card border-border">
                <RankingList variant="compact" limit={8} />
              </Card>
            </div>
          </div>
        )}

        {activeTab === "betting" && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="font-display font-bold text-3xl mb-2">Apostas</h1>
              <p className="text-muted-foreground">Aposte em suas partidas e ganhe 80% do valor</p>
            </div>
            
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="bg-secondary mb-6">
                <TabsTrigger value="active">Partidas Ativas</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>
              
              <TabsContent value="active">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="p-6 bg-card border-border">
                    <h3 className="font-display font-semibold text-lg mb-4">Sua Próxima Partida</h3>
                    <BettingPanel
                      playerName="João Silva"
                      playerRating={1850}
                      opponentName="ChessMaster99"
                      opponentRating={1920}
                      minBet={10}
                      maxBet={500}
                    />
                  </Card>
                  
                  <Card className="p-6 bg-card border-border">
                    <h3 className="font-display font-semibold text-lg mb-4">Estatísticas de Apostas</h3>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-secondary">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Apostado</span>
                          <span className="font-mono font-semibold">R$ 2.450</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-bet-win/10">
                        <div className="flex justify-between items-center">
                          <span className="text-bet-win">Ganhos Totais</span>
                          <span className="font-mono font-semibold text-bet-win">R$ 3.120</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Lucro Líquido</span>
                          <span className="font-mono font-semibold text-bet-win">+R$ 670</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Taxa de Sucesso</span>
                          <span className="font-mono font-semibold">68%</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="history">
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-3">
                    {[
                      { opponent: "GrandMaster_X", result: "win", bet: 100, payout: 80 },
                      { opponent: "KnightRider", result: "loss", bet: 50, payout: -50 },
                      { opponent: "QueenGambit", result: "win", bet: 75, payout: 60 },
                      { opponent: "RookiePro", result: "win", bet: 200, payout: 160 },
                      { opponent: "BishopKing", result: "loss", bet: 30, payout: -30 },
                    ].map((game, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${game.result === "win" ? "bg-bet-win" : "bg-bet-lose"}`} />
                          <div>
                            <p className="font-medium">vs {game.opponent}</p>
                            <p className="text-sm text-muted-foreground">
                              {game.result === "win" ? "Vitória" : "Derrota"} • Aposta: R$ {game.bet}
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono font-semibold ${game.result === "win" ? "text-bet-win" : "text-bet-lose"}`}>
                          {game.result === "win" ? "+" : ""}R$ {game.payout}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
    </main>
  );

  return (
    <div className={isMobile ? "flex flex-col min-h-screen bg-background" : "flex min-h-screen bg-background"}>
      {!isMobile && <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />}
      {isMobile && <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />}
      {mainContent}
      {isMobile && (
        <>
          {!hideBottomNav && (
            <MobileBottomNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onMenuClick={() => setMobileMenuOpen(true)}
            />
          )}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="p-0 w-[280px] max-w-[85vw] border-sidebar-border">
              <SidebarContent
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onItemClick={() => setMobileMenuOpen(false)}
                touchFriendly
              />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};

export default Index;
