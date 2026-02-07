-- Convites de partida entre amigos: normal ou apostada (valor definido pelo convidante)
CREATE TABLE public.game_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  bet_amount DECIMAL(14,2) NULL,
  time_control TEXT NOT NULL DEFAULT '10+0',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_game_invites_to_user_status ON public.game_invites(to_user_id, status);
CREATE INDEX idx_game_invites_from_user ON public.game_invites(from_user_id);

ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- Quem convida ou quem recebe pode ver o convite
CREATE POLICY "Users can view own game invites"
  ON public.game_invites FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Só o remetente pode inserir (criar convite)
CREATE POLICY "Users can create game invites as sender"
  ON public.game_invites FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Quem recebe pode atualizar para aceitar/recusar; remetente não altera após enviar
CREATE POLICY "Users can update invites they received"
  ON public.game_invites FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
