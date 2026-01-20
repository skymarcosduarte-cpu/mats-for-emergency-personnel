-- Create table for memory gallery photos
CREATE TABLE public.memory_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memory_gallery ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view gallery photos"
ON public.memory_gallery FOR SELECT
USING (true);

CREATE POLICY "Users can upload their own photos"
ON public.memory_gallery FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
ON public.memory_gallery FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_gallery;