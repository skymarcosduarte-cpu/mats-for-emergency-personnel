-- Add resolved_by column to track who resolved the help request
ALTER TABLE public.help_requests 
ADD COLUMN resolved_by uuid REFERENCES auth.users(id);