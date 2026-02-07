-- Realtime para friendships: quando alguém aceita/recusa, os dois veem a lista atualizada
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
