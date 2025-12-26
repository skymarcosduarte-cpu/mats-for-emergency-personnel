-- Allow users to delete their own profile (for account deletion)
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Allow users to delete their own role (cleanup on account deletion)
CREATE POLICY "Users can delete their own role" 
ON public.user_roles 
FOR DELETE 
USING (auth.uid() = user_id);