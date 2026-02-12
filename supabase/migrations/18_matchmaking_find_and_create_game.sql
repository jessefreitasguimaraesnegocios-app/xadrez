-- Matchmaking atômico: encontra oponente na fila e cria partida (modo normal, ELO).
-- Roda com SECURITY DEFINER para poder remover qualquer linha da fila.
CREATE OR REPLACE FUNCTION public.matchmaking_find_and_create_game(
  p_time_control TEXT,
  p_bet_amount DECIMAL DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_elo_rating INTEGER;
  v_opponent_id UUID;
  v_initial_sec INTEGER;
  v_game_id UUID;
  v_elo_range INTEGER := 100;
BEGIN
  v_user_id := auth.uid();
  SELECT pr.elo_rating INTO v_elo_rating FROM public.profiles pr WHERE pr.user_id = v_user_id;
  IF v_user_id IS NULL OR v_elo_rating IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_bet_amount IS NOT NULL AND p_bet_amount > 0 THEN
    RETURN NULL;
  END IF;

  SELECT mq.user_id
  INTO v_opponent_id
  FROM public.matchmaking_queue mq
  WHERE mq.time_control = p_time_control
    AND mq.user_id != v_user_id
    AND mq.bet_amount = 0
    AND mq.elo_rating >= v_elo_rating - v_elo_range
    AND mq.elo_rating <= v_elo_rating + v_elo_range
  ORDER BY mq.joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.matchmaking_queue WHERE user_id IN (v_user_id, v_opponent_id);

  v_initial_sec := LEAST(86400, GREATEST(0, (COALESCE((regexp_match(trim(p_time_control), '^(\d+)'))[1], '10'))::INTEGER * 60));
  INSERT INTO public.games (
    white_player_id, black_player_id, status, time_control, bet_amount,
    started_at, move_history,
    white_remaining_time, black_remaining_time, last_move_at
  )
  VALUES (
    v_user_id, v_opponent_id, 'in_progress',
    p_time_control, NULL,
    now(), '[]'::jsonb,
    v_initial_sec, v_initial_sec, now()
  )
  RETURNING id INTO v_game_id;

  RETURN v_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaking_find_and_create_game(TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_find_and_create_game(TEXT, DECIMAL) TO service_role;

-- Modo apostado: remove ambos da fila e retorna opponent_id para o cliente chamar create-match
CREATE OR REPLACE FUNCTION public.matchmaking_claim_opponent(
  p_time_control TEXT,
  p_bet_amount DECIMAL
)
RETURNS TABLE(opponent_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_elo_rating INTEGER;
  v_opponent_id UUID;
  v_elo_range INTEGER := 100;
BEGIN
  v_user_id := auth.uid();
  SELECT pr.elo_rating INTO v_elo_rating FROM public.profiles pr WHERE pr.user_id = v_user_id;
  IF v_user_id IS NULL OR v_elo_rating IS NULL OR p_bet_amount IS NULL OR p_bet_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT mq.user_id INTO v_opponent_id
  FROM public.matchmaking_queue mq
  WHERE mq.time_control = p_time_control
    AND mq.user_id != v_user_id
    AND mq.bet_amount > 0
    AND mq.elo_rating >= v_elo_rating - v_elo_range
    AND mq.elo_rating <= v_elo_rating + v_elo_range
  ORDER BY mq.joined_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.matchmaking_queue WHERE user_id IN (v_user_id, v_opponent_id);
  opponent_user_id := v_opponent_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.matchmaking_claim_opponent(TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_claim_opponent(TEXT, DECIMAL) TO service_role;
