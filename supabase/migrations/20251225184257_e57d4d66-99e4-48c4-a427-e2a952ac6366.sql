-- Create marketplace listings table
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'product',
  price DECIMAL(10,2),
  images TEXT[] DEFAULT '{}',
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone authenticated can view active listings that haven't expired
CREATE POLICY "Authenticated users can view active listings"
ON public.marketplace_listings
FOR SELECT
USING (is_active = true AND valid_until > now());

-- Users can create their own listings
CREATE POLICY "Users can create their own listings"
ON public.marketplace_listings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own listings
CREATE POLICY "Users can update their own listings"
ON public.marketplace_listings
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own listings
CREATE POLICY "Users can delete their own listings"
ON public.marketplace_listings
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for marketplace images
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace_images', 'marketplace_images', true);

-- Storage policies for marketplace images
CREATE POLICY "Anyone can view marketplace images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'marketplace_images');

CREATE POLICY "Authenticated users can upload marketplace images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'marketplace_images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own marketplace images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'marketplace_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own marketplace images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'marketplace_images' AND auth.uid()::text = (storage.foldername(name))[1]);