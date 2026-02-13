-- 1. Tournament pot: valor arrecadado das entradas (pago ao campeão ao final)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pot_balance DECIMAL(14,2) DEFAULT 0 NOT NULL;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_pot_balance_non_negative CHECK (pot_balance >= 0);

COMMENT ON COLUMN public.tournaments.pot_balance IS 'Valor arrecadado das entradas; pago ao campeão quando o torneio termina (RPC pay_tournament_winner ou processo admin).';

-- 2. Novos tipos de transação para torneio
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (
    type IN (
      'deposit','withdraw','bet_lock','bet_win','bet_refund',
      'tournament_entry','tournament_prize'
    )
  );
