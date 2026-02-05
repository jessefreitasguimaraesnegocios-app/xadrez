-- ============================================================
-- Wallet system: wallets, transactions, withdrawals, pix_deposits
-- RLS: users can only SELECT their wallet; no UPDATE/INSERT from client
-- ============================================================

-- 1. Wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance_available DECIMAL(14,2) DEFAULT 0 NOT NULL,
  balance_locked DECIMAL(14,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT wallets_balance_available_non_negative CHECK (balance_available >= 0),
  CONSTRAINT wallets_balance_locked_non_negative CHECK (balance_locked >= 0)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Users can only SELECT their own wallet. No UPDATE or INSERT policies for anon/authenticated.
-- Only service role (Edge Functions) can UPDATE/INSERT.
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Transactions table (immutable: no UPDATE/DELETE from client)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdraw','bet_lock','bet_win','bet_refund')),
  amount DECIMAL(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed','cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated = only service role (Edge Functions) can write.
-- Webhook needs to UPDATE status from pending to completed; no client can UPDATE/DELETE.

-- 3. pix_deposits: link asaas payment_id to user_id for webhook
CREATE TABLE public.pix_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.pix_deposits ENABLE ROW LEVEL SECURITY;

-- Only service role inserts/updates; users can view their own
CREATE POLICY "Users can view own pix_deposits"
  ON public.pix_deposits FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review','approved','processing','completed','failed','cancelled')),
  pix_key TEXT,
  pix_key_type TEXT,
  asaas_transfer_id TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  scheduled_after TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawals FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE for authenticated: only Edge Functions (service role) create/update withdrawals.

-- 5. Trigger: create wallet when profile is created
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_create_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_wallet_for_new_profile();

-- Backfill: create wallets for existing profiles that don't have one
INSERT INTO public.wallets (user_id)
SELECT p.user_id FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = p.user_id);

-- 6. Trigger: update wallets.updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for common queries
CREATE INDEX idx_transactions_user_id_created_at ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_user_id_status ON public.withdrawals(user_id, status);
CREATE INDEX idx_withdrawals_scheduled_asaas ON public.withdrawals(scheduled_after) WHERE asaas_transfer_id IS NULL AND status IN ('approved','processing');
CREATE INDEX idx_pix_deposits_asaas_payment_id ON public.pix_deposits(asaas_payment_id);

-- Realtime for wallet balance updates (e.g. after deposit webhook)
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
