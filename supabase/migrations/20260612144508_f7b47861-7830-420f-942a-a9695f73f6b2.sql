
DROP POLICY IF EXISTS "Anyone can view job CVs" ON storage.objects;

CREATE POLICY "Authenticated users can view job CVs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'job_cvs');
