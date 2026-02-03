-- Create job board table for employment opportunities
CREATE TABLE public.job_board (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL, -- Professional title (e.g., "Ingeniero de Sistemas")
  experience TEXT, -- Brief experience description
  position_sought TEXT NOT NULL, -- Position looking for or offering
  cv_url TEXT, -- Storage path to uploaded CV
  cv_filename TEXT, -- Original filename
  is_offering_job BOOLEAN DEFAULT false, -- true if posting a job, false if looking for work
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_board ENABLE ROW LEVEL SECURITY;

-- Create policies for job board
CREATE POLICY "Anyone can view active job posts"
ON public.job_board
FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can create their own job posts"
ON public.job_board
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job posts"
ON public.job_board
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job posts"
ON public.job_board
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_job_board_updated_at
BEFORE UPDATE ON public.job_board
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for CVs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('job_cvs', 'job_cvs', true, 10485760);

-- Storage policies for job CVs bucket
CREATE POLICY "Anyone can view job CVs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'job_cvs');

CREATE POLICY "Authenticated users can upload their own CVs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'job_cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own CVs"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'job_cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own CVs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'job_cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable realtime for job_board
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_board;