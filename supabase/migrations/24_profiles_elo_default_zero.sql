-- Novos jogadores começam com ELO 0 (em vez de 1200)
ALTER TABLE public.profiles
  ALTER COLUMN elo_rating SET DEFAULT 0;

-- Atualizar a função que cria perfil para novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := lower(regexp_replace(split_part(coalesce(NEW.email, NEW.id::text), '@', 1), '[^a-z0-9]', '', 'g'));
  IF length(base_username) < 3 THEN
    base_username := 'user_' || replace(substring(NEW.id::text from 1 for 8), '-', '');
  END IF;
  final_username := left(base_username, 25);

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = final_username) THEN
    final_username := 'user_' || replace(substring(NEW.id::text from 1 for 12), '-', '');
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, elo_rating)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(coalesce(NEW.email, ''), '@', 1)),
    0
  );
  RETURN NEW;
END;
$$;
