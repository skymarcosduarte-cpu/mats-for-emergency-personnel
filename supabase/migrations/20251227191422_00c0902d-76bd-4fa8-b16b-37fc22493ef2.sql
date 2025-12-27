-- Drop the problematic policies and create cleaner ones
DROP POLICY IF EXISTS "Users can upsert their own location" ON public.user_locations;
DROP POLICY IF EXISTS "Users can update their own location" ON public.user_locations;

-- Create explicit INSERT policy
CREATE POLICY "Users can insert their own location" 
ON public.user_locations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create explicit UPDATE policy with both USING and WITH CHECK
CREATE POLICY "Users can update their own location" 
ON public.user_locations 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);