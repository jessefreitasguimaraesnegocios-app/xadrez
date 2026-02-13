-- RPC atômica: inscrever em torneio (desconta entrada da carteira, credita no pot, insere participant)
CREATE OR REPLACE FUNCTION public.join_tournament_atomic(p_tournament_id UUID)
RETURNS TABLE (ok BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_entry_fee DECIMAL(14,2);
  v_max_participants INT;
  v_current_count INT;
  v_status TEXT;
  v_balance_avail DECIMAL(14,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Não autenticado.'::TEXT;
    RETURN;
  END IF;

  SELECT t.entry_fee, t.max_participants, t.status
  INTO v_entry_fee, v_max_participants, v_status
  FROM public.tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF v_entry_fee IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Torneio não encontrado.'::TEXT;
    RETURN;
  END IF;

  IF v_status <> 'upcoming' THEN
    RETURN QUERY SELECT FALSE, 'Torneio não está com inscrições abertas.'::TEXT;
    RETURN;
  END IF;

  v_entry_fee := GREATEST(0, COALESCE(v_entry_fee, 0));

  SELECT count(*)::INT INTO v_current_count
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id;

  IF v_current_count >= v_max_participants THEN
    RETURN QUERY SELECT FALSE, 'Torneio lotado.'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = p_tournament_id AND user_id = v_user_id) THEN
    RETURN QUERY SELECT FALSE, 'Você já está inscrito neste torneio.'::TEXT;
    RETURN;
  END IF;

  IF v_entry_fee > 0 THEN
    SELECT w.balance_available INTO v_balance_avail
    FROM public.wallets w
    WHERE w.user_id = v_user_id
    FOR UPDATE;

    IF v_balance_avail IS NULL THEN
      RETURN QUERY SELECT FALSE, 'Carteira não encontrada.'::TEXT;
      RETURN;
    END IF;

    IF v_balance_avail < v_entry_fee THEN
      RETURN QUERY SELECT FALSE, ('Saldo insuficiente. Entrada: R$ ' || v_entry_fee::TEXT || ', seu saldo: R$ ' || v_balance_avail::TEXT)::TEXT;
      RETURN;
    END IF;

    UPDATE public.wallets
    SET balance_available = balance_available - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.tournaments
    SET pot_balance = pot_balance + v_entry_fee
    WHERE id = p_tournament_id;

    INSERT INTO public.transactions (user_id, type, amount, status, metadata)
    VALUES (v_user_id, 'tournament_entry', -v_entry_fee, 'completed', jsonb_build_object('tournament_id', p_tournament_id));
  END IF;

  INSERT INTO public.tournament_participants (tournament_id, user_id)
  VALUES (p_tournament_id, v_user_id);

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
