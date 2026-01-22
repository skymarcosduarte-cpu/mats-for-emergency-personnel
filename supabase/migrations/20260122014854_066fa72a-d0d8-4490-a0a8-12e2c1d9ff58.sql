-- Tabla de streams de emergencia
CREATE TABLE public.emergency_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  clip_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de clips individuales
CREATE TABLE public.emergency_stream_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.emergency_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 15000,
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para emergency_streams
ALTER TABLE public.emergency_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all active streams" ON public.emergency_streams
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own streams" ON public.emergency_streams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streams" ON public.emergency_streams
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own streams" ON public.emergency_streams
  FOR DELETE USING (auth.uid() = user_id);

-- RLS para clips
ALTER TABLE public.emergency_stream_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clips" ON public.emergency_stream_clips
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own clips" ON public.emergency_stream_clips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own clips" ON public.emergency_stream_clips
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket para emergency streams (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('emergency-streams', 'emergency-streams', false);

-- Políticas de storage
CREATE POLICY "Users can upload to their folder" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'emergency-streams' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'emergency-streams' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete only their own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'emergency-streams' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_stream_clips;