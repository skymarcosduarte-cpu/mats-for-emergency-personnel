-- COMUNIDAD EX SOS Database Schema

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('RESCATISTA', 'FAMILIAR');

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'FAMILIAR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_rescatista(_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'RESCATISTA'
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  specialty TEXT,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User locations table (real-time tracking)
CREATE TABLE public.user_locations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Panic events table
CREATE TABLE public.panic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  panic_type TEXT NOT NULL CHECK (panic_type IN ('AMBULANCIA_PROPIA', 'AMBULANCIA_TERCERO', 'PATRULLA', 'MECANICO', 'PROTECCION_CIVIL')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.panic_events ENABLE ROW LEVEL SECURITY;

-- Help requests table (including 14 AYUDA)
CREATE TABLE public.help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('SISMO_AYUDA_14', 'GENERAL')),
  quake_event_id TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  message TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

-- Road reports table
CREATE TABLE public.road_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_id UUID,
  category TEXT NOT NULL CHECK (category IN ('BLOCKADE', 'ACCIDENT', 'PROTEST', 'HAZARD', 'OTHER')),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 4),
  title TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.road_reports ENABLE ROW LEVEL SECURITY;

-- Transit trips table
CREATE TABLE public.transit_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transit_type TEXT NOT NULL CHECK (transit_type IN ('ROAD', 'FLIGHT')),
  plates TEXT,
  companions TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  vehicle_type TEXT,
  airline TEXT,
  flight_number TEXT,
  departure_airport TEXT,
  arrival_airport TEXT,
  departure_time TIMESTAMP WITH TIME ZONE,
  arrival_time TIMESTAMP WITH TIME ZONE,
  eta TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARRIVED', 'CANCELLED', 'OVERDUE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  arrived_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.transit_trips ENABLE ROW LEVEL SECURITY;

-- Quake checkins table
CREATE TABLE public.quake_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usgs_event_id TEXT NOT NULL,
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  damage_report TEXT NOT NULL CHECK (damage_report IN ('OK', 'DAMAGE', 'UNSURE')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.quake_checkins ENABLE ROW LEVEL SECURITY;

-- Status messages table
CREATE TABLE public.status_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OK', 'NEED_HELP', 'UNKNOWN')),
  message TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.status_messages ENABLE ROW LEVEL SECURITY;

-- Report media table (references to storage)
CREATE TABLE public.report_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('help_request', 'road_report')),
  report_id UUID NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio')),
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.report_media ENABLE ROW LEVEL SECURITY;

-- Invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- App state table (disaster mode, etc.)
CREATE TABLE public.app_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_mode BOOLEAN DEFAULT false,
  disaster_started_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- App releases table (version management)
CREATE TABLE public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  min_supported TEXT NOT NULL,
  release_notes TEXT,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Insert initial app state
INSERT INTO public.app_state (disaster_mode, disaster_started_at) VALUES (false, NULL);

-- Insert initial version
INSERT INTO public.app_releases (version, min_supported, release_notes) VALUES ('1.0.0', '1.0.0', 'Initial release');

-- RLS POLICIES

-- User roles policies
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User locations policies (all authenticated users can see online locations for map)
CREATE POLICY "Authenticated users can view online locations" ON public.user_locations FOR SELECT TO authenticated USING (is_online = true);
CREATE POLICY "Users can upsert their own location" ON public.user_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own location" ON public.user_locations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Panic events policies
CREATE POLICY "Authenticated users can view panic events" ON public.panic_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create panic events" ON public.panic_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own panic events" ON public.panic_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Help requests policies
CREATE POLICY "Authenticated users can view help requests" ON public.help_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create help requests" ON public.help_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own help requests" ON public.help_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Road reports policies
CREATE POLICY "Authenticated users can view active road reports" ON public.road_reports FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Users can create road reports" ON public.road_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own road reports" ON public.road_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Transit trips policies
CREATE POLICY "Users can view their own trips" ON public.transit_trips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create trips" ON public.transit_trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trips" ON public.transit_trips FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Quake checkins policies
CREATE POLICY "Authenticated users can view quake checkins" ON public.quake_checkins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create quake checkins" ON public.quake_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Status messages policies
CREATE POLICY "Authenticated users can view status messages" ON public.status_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create status messages" ON public.status_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Report media policies
CREATE POLICY "Authenticated users can view report media" ON public.report_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create report media" ON public.report_media FOR INSERT TO authenticated WITH CHECK (true);

-- Invites policies
CREATE POLICY "Authenticated users can view invites" ON public.invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Rescatistas can create invites" ON public.invites FOR INSERT TO authenticated WITH CHECK (public.is_rescatista(auth.uid()));
CREATE POLICY "Invite creators can update their invites" ON public.invites FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- App state policies (read-only for users)
CREATE POLICY "Authenticated users can view app state" ON public.app_state FOR SELECT TO authenticated USING (true);

-- App releases policies (read-only for users)
CREATE POLICY "Anyone can view app releases" ON public.app_releases FOR SELECT USING (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.road_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_locations_updated_at BEFORE UPDATE ON public.user_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_state_updated_at BEFORE UPDATE ON public.app_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create user role on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Default role is FAMILIAR, can be changed later
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'FAMILIAR');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();