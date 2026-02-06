-- RPC atômica: incrementar saldo da wallet (evita race condition em webhooks concorrentes)
-- Só incrementa; valor deve ser positivo (depósitos). Chamada apenas por Edge Functions (service role).

CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(14,2)
)
RETURNS TABLE (id UUID, balance_available DECIMAL(14,2))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.wallets w
  SET
    balance_available = w.balance_available + p_amount,
    updated_at = now()
  WHERE w.user_id = p_user_id
  RETURNING w.id, w.balance_available;
END;
$$;
