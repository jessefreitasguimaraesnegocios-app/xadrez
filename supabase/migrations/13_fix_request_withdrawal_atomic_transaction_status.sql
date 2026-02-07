-- Fix: transactions table only allows status IN ('pending','completed','failed','cancelled').
-- request_withdrawal_atomic was inserting 'pending_review', causing 500. Use 'pending' for the transaction.
CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  p_user_id UUID,
  p_amount DECIMAL(14,2),
  p_pix_key TEXT,
  p_pix_key_type TEXT,
  p_scheduled_after TIMESTAMPTZ
)
RETURNS TABLE (id UUID, status TEXT, scheduled_after TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_available DECIMAL(14,2);
  v_withdrawal_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_pix_key IS NULL OR trim(p_pix_key) = '' THEN
    RETURN;
  END IF;

  SELECT w.id, w.balance_available
  INTO v_wallet_id, v_available
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN;
  END IF;

  IF v_available < p_amount THEN
    RETURN;
  END IF;

  UPDATE public.wallets
  SET balance_available = balance_available - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.withdrawals (user_id, amount, status, pix_key, pix_key_type, scheduled_after)
  VALUES (p_user_id, p_amount, 'pending_review', trim(p_pix_key), p_pix_key_type, p_scheduled_after)
  RETURNING public.withdrawals.id INTO v_withdrawal_id;

  INSERT INTO public.transactions (user_id, type, amount, status, metadata)
  VALUES (p_user_id, 'withdraw', -p_amount, 'pending', jsonb_build_object('withdrawal_id', v_withdrawal_id));

  RETURN QUERY
  SELECT w.id, w.status::TEXT, w.scheduled_after
  FROM public.withdrawals w
  WHERE w.id = v_withdrawal_id;
END;
$$;
