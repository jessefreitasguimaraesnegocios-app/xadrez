import { useState, useRef, useEffect } from 'react';
import { useGameChat } from '@/hooks/useGameChat';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameChatProps {
  gameId: string | null;
}

const GameChat = ({ gameId }: GameChatProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useGameChat(gameId);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const { error } = await sendMessage(inputValue);
    if (!error) {
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!gameId) return null;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 h-96 flex flex-col shadow-xl border-border">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-secondary rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium text-sm">Chat da Partida</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setIsOpen(false)}
        >
          ×
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  message.sender_id === user?.id ? "ml-auto items-end" : "items-start"
                )}
              >
                <span className="text-xs text-muted-foreground mb-1">
                  {message.sender_username || 'Anônimo'}
                </span>
                <div
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm",
                    message.sender_id === user?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          placeholder="Digite uma mensagem..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 h-9"
        />
        <Button size="sm" className="h-9 px-3" onClick={handleSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default GameChat;
