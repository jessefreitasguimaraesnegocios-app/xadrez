import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Message {
  id: string;
  game_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_username?: string;
}

export const useGameChat = (gameId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch existing messages
  useEffect(() => {
    if (!gameId || !user) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('game_messages')
        .select(`
          *,
          profiles:sender_id (username)
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else if (data) {
        setMessages(data.map(msg => ({
          ...msg,
          sender_username: (msg.profiles as unknown as { username: string })?.username
        })));
      }
      setLoading(false);
    };

    fetchMessages();
  }, [gameId, user]);

  // Subscribe to new messages + visibility refetch + short poll
  useEffect(() => {
    if (!gameId || !user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('game_messages')
        .select(`
          *,
          profiles:sender_id (username)
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(data.map(msg => ({
          ...msg,
          sender_username: (msg.profiles as unknown as { username: string })?.username
        })));
      }
    };

    const channel = supabase
      .channel(`game-chat-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_messages',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', payload.new.sender_id)
            .single();
          const newMessage: Message = {
            ...(payload.new as Message),
            sender_username: profile?.username,
          };
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') fetchMessages();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchMessages();
    };
    document.addEventListener('visibilitychange', onVisible);

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMessages();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [gameId, user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!gameId || !user || !content.trim()) return { error: new Error('Invalid input') };

    const { error } = await supabase
      .from('game_messages')
      .insert({
        game_id: gameId,
        sender_id: user.id,
        content: content.trim(),
      });

    if (error) {
      console.error('Error sending message:', error);
      return { error };
    }

    return { error: null };
  }, [gameId, user]);

  return {
    messages,
    loading,
    sendMessage,
  };
};
