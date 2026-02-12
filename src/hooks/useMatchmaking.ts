import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionAuth';
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
  searchTimeControl: string | null;
  searchBetAmount: number | null;
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
    searchTimeControl: null,
    searchBetAmount: null,
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
          const status = payload.new?.status;
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && (status === 'waiting' || status === 'in_progress')) {
            setState(prev => ({
              ...prev,
              matchFound: true,
              gameId: payload.new.id,
              isSearching: false,
              searchTimeControl: null,
              searchBetAmount: null,
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
          const status = payload.new?.status;
          if (status === 'in_progress' && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            setState(prev => ({
              ...prev,
              matchFound: true,
              gameId: payload.new.id,
              isSearching: false,
              searchTimeControl: null,
              searchBetAmount: null,
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

  useEffect(() => {
    if (!state.isSearching || !state.searchTimeControl || state.searchBetAmount == null || !user || !profile) return;
    const interval = setInterval(() => {
      findMatch(state.searchTimeControl!, state.searchBetAmount!);
    }, 2500);
    return () => clearInterval(interval);
  }, [state.isSearching, state.searchTimeControl, state.searchBetAmount, user?.id, profile?.elo_rating]);

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
        searchTimeControl: timeControl,
        searchBetAmount: betAmount,
      }));

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

    const isNormal = betAmount === 0;
    const eloRange = 100;

    let query = supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('time_control', timeControl)
      .neq('user_id', user.id)
      .gte('elo_rating', profile.elo_rating - eloRange)
      .lte('elo_rating', profile.elo_rating + eloRange)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (isNormal) {
      query = query.eq('bet_amount', 0);
    } else {
      query = query.gt('bet_amount', 0);
    }

    const { data: opponents, error } = await query;

    if (error) {
      console.error('Error finding match:', error);
      return;
    }

    if (opponents && opponents.length > 0) {
      const opponent = opponents[0] as QueueEntry;
      const { data: claimed } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', opponent.user_id)
        .select('id');
      if (!claimed?.length) {
        return;
      }
      const finalBet = Math.min(betAmount, opponent.bet_amount ?? 0);

      if (finalBet > 0) {
        const { data: { session: refreshed }, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError || !refreshed?.access_token) {
          await supabase.auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Sessão expirada',
            description: 'Faça login novamente para continuar.',
          });
          setState(prev => ({ ...prev, isSearching: false }));
          await supabase.from('matchmaking_queue').delete().in('user_id', [user.id, opponent.user_id]);
          return;
        }
        const { data: fnData, error: fnError } = await invokeEdgeFunction<{ id?: string; error?: string }>(
          refreshed,
          'create-match',
          {
            whitePlayerId: user.id,
            blackPlayerId: opponent.user_id,
            timeControl,
            betAmount: finalBet,
          }
        );

        if (fnError || fnData?.error) {
          toast({
            variant: 'destructive',
            title: 'Erro ao criar partida',
            description: fnData?.error ?? fnError?.message ?? 'Saldo insuficiente ou erro no servidor.',
          });
          setState(prev => ({ ...prev, isSearching: false }));
          await supabase.from('matchmaking_queue').delete().in('user_id', [user.id, opponent.user_id]);
          return;
        }

        const gameId = fnData?.id ?? null;
        await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
        setState(prev => ({
          ...prev,
          matchFound: true,
          gameId,
          isSearching: false,
          searchTimeControl: null,
          searchBetAmount: null,
        }));
        toast({ title: 'Partida encontrada!', description: 'O jogo vai começar!' });
        return;
      }

      const tcMinutes = parseInt(String(timeControl).trim().split('+')[0], 10) || 10;
      const initialSec = Math.min(86400, Math.max(0, tcMinutes * 60));
      const nowIso = new Date().toISOString();
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          white_player_id: user.id,
          black_player_id: opponent.user_id,
          status: 'in_progress',
          time_control: timeControl,
          bet_amount: null,
          started_at: nowIso,
          white_remaining_time: initialSec,
          black_remaining_time: initialSec,
          last_move_at: nowIso,
        })
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
        return;
      }

      await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
      setState(prev => ({
        ...prev,
        matchFound: true,
        gameId: game.id,
        isSearching: false,
        searchTimeControl: null,
        searchBetAmount: null,
      }));
      toast({ title: 'Partida encontrada!', description: 'O jogo vai começar!' });
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
        searchTimeControl: null,
        searchBetAmount: null,
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
      searchTimeControl: null,
      searchBetAmount: null,
    });
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    resetMatchmaking,
  };
};
