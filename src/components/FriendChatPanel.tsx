import { useState, useRef, useEffect } from "react";
import { useDirectChat } from "@/hooks/useDirectChat";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FriendProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface FriendChatPanelProps {
  friend: FriendProfile;
  onClose: () => void;
  className?: string;
}

const FriendChatPanel = ({ friend, onClose, className }: FriendChatPanelProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useDirectChat(friend.user_id);
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayName = friend.display_name || friend.username;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const { error } = await sendMessage(inputValue);
    if (!error) setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card
      className={cn(
        "fixed bottom-4 right-4 w-80 h-[380px] flex flex-col shadow-xl border-border z-50",
        className
      )}
    >
      <div className="p-2 border-b border-border flex items-center justify-between bg-secondary rounded-t-lg shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={friend.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm truncate">{displayName}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2 min-h-0">
        <div className="space-y-2 pr-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Nenhuma mensagem ainda. Digite algo!</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[90%]",
                  msg.sender_id === user?.id ? "ml-auto items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm break-words",
                    msg.sender_id === user?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border flex gap-2 shrink-0">
        <Input
          placeholder="Mensagem..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-9 text-sm"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default FriendChatPanel;
