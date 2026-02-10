-- Cria perfil automaticamente para todo novo usuário (email ou OAuth/Google).
-- Assim o login com Google funciona sem precisar de fluxo extra no frontend.
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
  -- username único: prefixo do email (sem caracteres especiais) ou "user_" + parte do id
  base_username := lower(regexp_replace(split_part(coalesce(NEW.email, NEW.id::text), '@', 1), '[^a-z0-9]', '', 'g'));
  IF length(base_username) < 3 THEN
    base_username := 'user_' || replace(substring(NEW.id::text from 1 for 8), '-', '');
  END IF;
  final_username := left(base_username, 25);

  -- Garantir unicidade: se já existir, usa user_id
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = final_username) THEN
    final_username := 'user_' || replace(substring(NEW.id::text from 1 for 12), '-', '');
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, elo_rating)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(coalesce(NEW.email, ''), '@', 1)),
    1200
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
