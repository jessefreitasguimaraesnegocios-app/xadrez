-- Mensagens não lidas: receiver pode marcar como lida ao abrir o chat
ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Receiver pode atualizar (para marcar read_at)
CREATE POLICY "Receivers can update read_at"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);
