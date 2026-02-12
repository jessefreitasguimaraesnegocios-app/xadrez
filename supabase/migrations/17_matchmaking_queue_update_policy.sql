-- Permitir que o usuário atualize a própria linha na fila (para upsert ao entrar de novo)
CREATE POLICY "Users can update own queue entry"
  ON public.matchmaking_queue FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
