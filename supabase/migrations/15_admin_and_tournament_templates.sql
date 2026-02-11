-- Admin flag on profiles (only service role or self can update; admins see admin UI).
-- Para tornar um usuário admin: UPDATE profiles SET is_admin = true WHERE user_id = 'uuid-do-usuario';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL;

-- Tournament templates: define recurring tournaments (admin creates these, cron or button generates actual tournaments)
CREATE TABLE IF NOT EXISTS public.tournament_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  format TEXT CHECK (format IN ('swiss', 'knockout', 'round_robin')) DEFAULT 'swiss' NOT NULL,
  max_participants INTEGER DEFAULT 32 NOT NULL,
  entry_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
  platform_fee_pct DECIMAL(5,2) DEFAULT 10 NOT NULL,
  time_control TEXT DEFAULT '10+0' NOT NULL,
  times_per_day INTEGER DEFAULT 1 NOT NULL,
  time_slots TEXT[] DEFAULT ARRAY['20:00']::TEXT[],
  duration_minutes INTEGER,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT tournament_templates_times_per_day_positive CHECK (times_per_day > 0 AND times_per_day <= 24),
  CONSTRAINT tournament_templates_platform_fee_pct_range CHECK (platform_fee_pct >= 0 AND platform_fee_pct <= 100)
);

ALTER TABLE public.tournament_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates (we will enforce in Edge Function; here allow read for all or restrict to service role)
-- For simplicity: no direct client access; admin does everything via Edge Functions with auth.uid() and profile.is_admin check
CREATE POLICY "Service role and authenticated can read tournament_templates"
  ON public.tournament_templates FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (admin actions go through Edge Function with service role)
-- So we don't create INSERT/UPDATE/DELETE policies for authenticated; the Edge Function uses service role.
-- If you want admins to manage from client with RLS, you'd add:
-- CREATE POLICY "Admins can manage templates" ON tournament_templates FOR ALL USING (
--   (SELECT is_admin FROM profiles WHERE user_id = auth.uid()) = true
-- );
-- We'll use Edge Function for all admin writes, so no INSERT/UPDATE/DELETE policy for authenticated = only service role.

COMMENT ON TABLE public.tournament_templates IS 'Templates for auto-generating tournaments; admin configures, cron or button creates rows in tournaments.';
