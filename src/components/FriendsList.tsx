import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Swords, MessageCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockFriends = [
  { id: 1, name: "ChessMaster99", rating: 1850, isOnline: true, status: "Jogando" },
  { id: 2, name: "KnightRider", rating: 1720, isOnline: true, status: "Online" },
  { id: 3, name: "QueenGambit", rating: 1650, isOnline: false, status: "Offline" },
  { id: 4, name: "RookiePro", rating: 1580, isOnline: true, status: "Em torneio" },
  { id: 5, name: "BishopKing", rating: 1490, isOnline: false, status: "Offline" },
];

const FriendsList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState("");
  const { toast } = useToast();

  const filteredFriends = mockFriends.filter((friend) =>
    friend.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddFriend = () => {
    if (newFriendName.trim()) {
      toast({
        title: "Solicitação enviada!",
        description: `Pedido de amizade enviado para ${newFriendName}`,
      });
      setNewFriendName("");
      setAddFriendOpen(false);
    }
  };

  const handleInviteToGame = (friendName: string) => {
    toast({
      title: "Convite enviado!",
      description: `${friendName} foi convidado para uma partida`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl">Amigos</h2>
        <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="font-display">Adicionar Amigo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Nome de usuário"
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="bg-secondary"
              />
              <Button onClick={handleAddFriend} className="w-full">
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar amigos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-secondary"
        />
      </div>

      <ScrollArea className="h-[280px]">
        <div className="space-y-2 pr-4">
          {filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-secondary transition-colors group"
            >
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {friend.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                    friend.isOnline ? "bg-bet-win" : "bg-muted"
                  }`}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{friend.name}</p>
                <p className="text-xs text-muted-foreground">{friend.rating} ELO • {friend.status}</p>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleInviteToGame(friend.name)}
                  disabled={!friend.isOnline}
                >
                  <Swords className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FriendsList;
