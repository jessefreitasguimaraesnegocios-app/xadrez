import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface QueueEntry {
  id: string;
  user_id: string;
  elo_rating: number;
  time_control: string;
  bet_amount: number;
  joined_at: string;
}

interface MatchmakingState {
  isSearching: boolean;
  queuePosition: number;
  estimatedWait: string;
  matchFound: boolean;
  gameId: string | null;
}

export const useMatchmaking = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<MatchmakingState>({
    isSearching: false,
    queuePosition: 0,
    estimatedWait: '--',
    matchFound: false,
    gameId: null,
  });

  // Listen for queue changes and match creation
  useEffect(() => {
    if (!user || !state.isSearching) return;

    const channel = supabase
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `white_player_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'waiting') {
            setState(prev => ({
              ...prev,
              matchFound: true,
              gameId: payload.new.id,
              isSearching: false,
            }));
            toast({
              title: 'Partida encontrada!',
              description: 'Preparando o tabuleiro...',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `black_player_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.status === 'in_progress') {
            setState(prev => ({
              ...prev,
              matchFound: true,
              gameId: payload.new.id,
              isSearching: false,
            }));
            toast({
              title: 'Partida encontrada!',
              description: 'O jogo vai começar!',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, state.isSearching, toast]);

  const joinQueue = useCallback(async (timeControl: string, betAmount: number = 0) => {
    if (!user || !profile) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa estar logado para jogar.',
      });
      return;
    }

    try {
      // Remove from queue if already in
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      // Add to queue
      const { error: queueError } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          elo_rating: profile.elo_rating,
          time_control: timeControl,
          bet_amount: betAmount,
        });

      if (queueError) throw queueError;

      setState(prev => ({
        ...prev,
        isSearching: true,
        matchFound: false,
        gameId: null,
      }));

      // Try to find a match
      await findMatch(timeControl, betAmount);
    } catch (error) {
      console.error('Error joining queue:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível entrar na fila.',
      });
    }
  }, [user, profile, toast]);

  const findMatch = async (timeControl: string, betAmount: number) => {
    if (!user || !profile) return;

    // Look for opponents with similar ELO (within 200 points)
    const { data: opponents, error } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('time_control', timeControl)
      .neq('user_id', user.id)
      .gte('elo_rating', profile.elo_rating - 200)
      .lte('elo_rating', profile.elo_rating + 200)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error finding match:', error);
      return;
    }

    if (opponents && opponents.length > 0) {
      const opponent = opponents[0] as QueueEntry;
      
      // Create a new game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          white_player_id: user.id,
          black_player_id: opponent.user_id,
          status: 'in_progress',
          time_control: timeControl,
          bet_amount: Math.min(betAmount, opponent.bet_amount),
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
        return;
      }

      // Remove both players from queue
      await supabase
        .from('matchmaking_queue')
        .delete()
        .in('user_id', [user.id, opponent.user_id]);

      setState(prev => ({
        ...prev,
        matchFound: true,
        gameId: game.id,
        isSearching: false,
      }));

      toast({
        title: 'Partida encontrada!',
        description: 'O jogo vai começar!',
      });
    }
  };

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      setState({
        isSearching: false,
        queuePosition: 0,
        estimatedWait: '--',
        matchFound: false,
        gameId: null,
      });
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  }, [user]);

  const resetMatchmaking = useCallback(() => {
    setState({
      isSearching: false,
      queuePosition: 0,
      estimatedWait: '--',
      matchFound: false,
      gameId: null,
    });
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    resetMatchmaking,
  };
};
