-- Create community chat messages table
CREATE TABLE public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  audio_url TEXT,
  audio_duration_ms INTEGER,
  context_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'clave100', 'drill'
  context_id UUID, -- Optional: links to clave100_drills.id or internal_messages.id for the triggering event
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view community messages"
  ON public.community_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send community messages"
  ON public.community_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own community messages"
  ON public.community_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Enable realtime for community_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;

-- Add index for faster queries
CREATE INDEX idx_community_messages_created_at ON public.community_messages(created_at DESC);
CREATE INDEX idx_community_messages_context ON public.community_messages(context_type, context_id);