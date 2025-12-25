-- Drop the foreign key constraint on invites.created_by so system/test invites can be created
ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS invites_created_by_fkey;

-- Insert a test invite code
INSERT INTO public.invites (code, created_by, max_uses, expires_at)
VALUES ('TEST2024', '00000000-0000-0000-0000-000000000000', 100, now() + interval '30 days');