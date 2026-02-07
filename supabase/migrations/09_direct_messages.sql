-- Chat direto entre amigos (estilo League of Legends)
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_direct_messages_receiver_created ON public.direct_messages(receiver_id, created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas mensagens em que participa (enviou ou recebeu)
CREATE POLICY "Users can view own direct messages"
  ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Só pode enviar como sender
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
