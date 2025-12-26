-- Allow authenticated users to see community member roles (needed to render distinct map icons)
-- This only exposes the role label (RESCATISTA/FAMILIAR), no PII.

CREATE POLICY "Authenticated users can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);
