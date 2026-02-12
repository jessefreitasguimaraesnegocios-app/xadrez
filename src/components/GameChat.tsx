import { useState, useRef, useEffect } from 'react';
import { useGameChat } from '@/hooks/useGameChat';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { FloatingChatContainer } from '@/components/FloatingChatContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, Phone, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameChatProps {
  gameId: string | null;
  /** User id do oponente (para ligação de voz). */
  opponentUserId?: string | null;
  /** Controlado externamente (ex.: botão "Chat" na partida). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const GameChat = ({ gameId, opponentUserId, open: controlledOpen, onOpenChange }: GameChatProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useGameChat(gameId);
  const {
    status: callStatus,
    error: callError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    setRemoteAudioRef,
  } = useVoiceCall(opponentUserId ?? null);
  const [inputValue, setInputValue] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen;
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
    if (isControlled) return null;
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <FloatingChatContainer
      width={320}
      height={384}
      onClose={() => setIsOpen(false)}
      header={
        <>
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium text-sm truncate">Chat da Partida</span>
          {opponentUserId && callStatus === 'idle' && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startCall} title="Ligar (voz)">
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
            <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={endCall} title="Encerrar chamada">
              <PhoneOff className="h-4 w-4" />
            </Button>
          )}
        </>
      }
      bubbleContent={<MessageCircle className="h-6 w-6" />}
    >
      {callError && (
        <p className="px-3 py-1 text-xs text-destructive bg-destructive/10">{callError}</p>
      )}
      {(callStatus === 'calling' || callStatus === 'connecting') && (
        <p className="px-3 py-1 text-xs text-muted-foreground text-center">
          {callStatus === 'calling' ? 'Chamando...' : 'Conectando...'}
        </p>
      )}
      {callStatus === 'ringing' && (
        <div className="p-3 border-b border-border bg-muted/50 flex flex-col items-center gap-2">
          <p className="text-sm font-medium">Chamada do oponente</p>
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="gap-1" onClick={acceptCall}>
              <Phone className="h-4 w-4" />
              Atender
            </Button>
            <Button size="sm" variant="destructive" className="gap-1" onClick={rejectCall}>
              <PhoneOff className="h-4 w-4" />
              Recusar
            </Button>
          </div>
        </div>
      )}
      {callStatus === 'connected' && (
        <p className="px-3 py-1 text-xs text-primary font-medium text-center bg-primary/10">
          Em chamada
        </p>
      )}
      <audio ref={setRemoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-3" ref={scrollRef}>
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
      <div className="p-3 border-t border-border flex gap-2 shrink-0">
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
    </FloatingChatContainer>
  );
};

export default GameChat;
