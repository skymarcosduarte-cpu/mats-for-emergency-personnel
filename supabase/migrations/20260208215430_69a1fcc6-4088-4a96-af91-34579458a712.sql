-- Allow authorized super users to delete any community message
CREATE POLICY "Authorized users can delete any community message"
ON public.community_messages
FOR DELETE
USING (
  auth.uid() = ANY (ARRAY[
    '7c823685-369d-4f62-8459-80486832ba1a'::uuid,
    '0e0d5ee7-628d-4a98-af26-b60ede2536ce'::uuid
  ])
);