-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  elo_rating INTEGER DEFAULT 1200 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  draws INTEGER DEFAULT 0 NOT NULL,
  total_bet_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_winnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
  is_online BOOLEAN DEFAULT false NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, friend_id)
);

-- Enable RLS on friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Friendships policies
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned')) DEFAULT 'waiting' NOT NULL,
  result TEXT CHECK (result IN ('white_wins', 'black_wins', 'draw', 'abandoned', NULL)),
  time_control TEXT DEFAULT '10+0' NOT NULL,
  fen_position TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  move_history JSONB DEFAULT '[]'::jsonb NOT NULL,
  bet_amount DECIMAL(10,2) DEFAULT 0,
  white_remaining_time INTEGER,
  black_remaining_time INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Games are viewable by everyone"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Players can update their games"
  ON public.games FOR UPDATE
  USING (auth.uid() = white_player_id OR auth.uid() = black_player_id);

-- Matchmaking queue table
CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL UNIQUE,
  elo_rating INTEGER NOT NULL,
  time_control TEXT DEFAULT '10+0' NOT NULL,
  bet_amount DECIMAL(10,2) DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on matchmaking_queue
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Matchmaking queue policies
CREATE POLICY "Queue is viewable by authenticated users"
  ON public.matchmaking_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join queue"
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave queue"
  ON public.matchmaking_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Game chat messages
CREATE TABLE public.game_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on game_messages
ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;

-- Game messages policies
CREATE POLICY "Game players can view messages"
  ON public.game_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE id = game_id 
      AND (white_player_id = auth.uid() OR black_player_id = auth.uid())
    )
  );

CREATE POLICY "Game players can send messages"
  ON public.game_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE id = game_id 
      AND (white_player_id = auth.uid() OR black_player_id = auth.uid())
    )
  );

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  format TEXT CHECK (format IN ('swiss', 'knockout', 'round_robin')) DEFAULT 'swiss' NOT NULL,
  status TEXT CHECK (status IN ('upcoming', 'in_progress', 'completed')) DEFAULT 'upcoming' NOT NULL,
  max_participants INTEGER DEFAULT 64 NOT NULL,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  prize_pool DECIMAL(10,2) DEFAULT 0,
  time_control TEXT DEFAULT '10+0' NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Tournaments policies
CREATE POLICY "Tournaments are viewable by everyone"
  ON public.tournaments FOR SELECT
  USING (true);

-- Tournament participants
CREATE TABLE public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  score DECIMAL(5,2) DEFAULT 0 NOT NULL,
  rank INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS on tournament_participants
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Tournament participants policies
CREATE POLICY "Participants are viewable by everyone"
  ON public.tournament_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join tournaments"
  ON public.tournament_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave tournaments"
  ON public.tournament_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for games and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;