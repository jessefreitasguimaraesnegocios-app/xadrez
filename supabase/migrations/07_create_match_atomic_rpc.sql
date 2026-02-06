-- Atomic create match: lock both wallets (FOR UPDATE), deduct/lock bet, insert game and transactions.
-- Lock order by user_id to avoid deadlocks.

CREATE OR REPLACE FUNCTION public.create_match_atomic(
  p_white_player_id UUID,
  p_black_player_id UUID,
  p_time_control TEXT,
  p_bet_amount DECIMAL(14,2)
)
RETURNS SETOF public.games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet DECIMAL(14,2);
  v_white_avail DECIMAL(14,2);
  v_white_locked DECIMAL(14,2);
  v_black_avail DECIMAL(14,2);
  v_black_locked DECIMAL(14,2);
  v_first_avail DECIMAL(14,2);
  v_first_locked DECIMAL(14,2);
  v_second_avail DECIMAL(14,2);
  v_second_locked DECIMAL(14,2);
  v_game_id UUID;
BEGIN
  v_bet := GREATEST(0, COALESCE(p_bet_amount, 0));

  IF v_bet > 0 THEN
    -- Lock both wallets in deterministic order (by user_id) to avoid deadlock
    SELECT w.balance_available, w.balance_locked
    INTO v_first_avail, v_first_locked
    FROM public.wallets w
    WHERE w.user_id = LEAST(p_white_player_id, p_black_player_id)
    FOR UPDATE;

    SELECT w.balance_available, w.balance_locked
    INTO v_second_avail, v_second_locked
    FROM public.wallets w
    WHERE w.user_id = GREATEST(p_white_player_id, p_black_player_id)
    FOR UPDATE;

    IF v_first_avail IS NULL OR v_second_avail IS NULL THEN
      RETURN;
    END IF;

    IF p_white_player_id < p_black_player_id THEN
      v_white_avail := v_first_avail;  v_white_locked := v_first_locked;
      v_black_avail := v_second_avail; v_black_locked := v_second_locked;
    ELSE
      v_white_avail := v_second_avail; v_white_locked := v_second_locked;
      v_black_avail := v_first_avail;  v_black_locked := v_first_locked;
    END IF;

    IF v_white_avail < v_bet OR v_black_avail < v_bet THEN
      RETURN;
    END IF;

    UPDATE public.wallets
    SET balance_available = balance_available - v_bet,
        balance_locked = balance_locked + v_bet,
        updated_at = now()
    WHERE user_id = p_white_player_id;

    UPDATE public.wallets
    SET balance_available = balance_available - v_bet,
        balance_locked = balance_locked + v_bet,
        updated_at = now()
    WHERE user_id = p_black_player_id;
  END IF;

  INSERT INTO public.games (
    white_player_id, black_player_id, status, time_control, bet_amount,
    started_at, move_history
  )
  VALUES (
    p_white_player_id, p_black_player_id, 'in_progress',
    COALESCE(NULLIF(trim(p_time_control), ''), '10+0')::TEXT,
    CASE WHEN v_bet > 0 THEN v_bet ELSE NULL END,
    now(), '[]'::jsonb
  )
  RETURNING id INTO v_game_id;

  IF v_bet > 0 AND v_game_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, type, amount, status, metadata)
    VALUES
      (p_white_player_id, 'bet_lock', -v_bet, 'completed', jsonb_build_object('game_id', v_game_id)),
      (p_black_player_id, 'bet_lock', -v_bet, 'completed', jsonb_build_object('game_id', v_game_id));
  END IF;

  RETURN QUERY
  SELECT g.* FROM public.games g WHERE g.id = v_game_id;
END;
$$;
