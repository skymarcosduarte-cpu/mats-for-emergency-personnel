-- Add photo_date column to memory_gallery
ALTER TABLE public.memory_gallery ADD COLUMN photo_date DATE;

-- Create likes table for gallery photos
CREATE TABLE public.memory_gallery_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES public.memory_gallery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

-- Create comments table for gallery photos
CREATE TABLE public.memory_gallery_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES public.memory_gallery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL CHECK (char_length(comment) <= 200),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.memory_gallery_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_gallery_comments ENABLE ROW LEVEL SECURITY;

-- Likes policies
CREATE POLICY "Anyone can view likes"
ON public.memory_gallery_likes FOR SELECT USING (true);

CREATE POLICY "Users can like photos"
ON public.memory_gallery_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
ON public.memory_gallery_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments"
ON public.memory_gallery_comments FOR SELECT USING (true);

CREATE POLICY "Users can add comments"
ON public.memory_gallery_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.memory_gallery_comments FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for both
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_gallery_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_gallery_comments;