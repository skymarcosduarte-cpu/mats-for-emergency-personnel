
-- 1) Lock down get_shared_trip: only edge functions (service_role) may call it.
REVOKE ALL ON FUNCTION public.get_shared_trip(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_shared_trip(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_trip(uuid) TO service_role;

-- 2) Memory gallery: restrict public SELECT policies to authenticated users only.
DROP POLICY IF EXISTS "Anyone can view gallery photos" ON public.memory_gallery;
CREATE POLICY "Authenticated users can view gallery photos"
  ON public.memory_gallery
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view comments" ON public.memory_gallery_comments;
CREATE POLICY "Authenticated users can view comments"
  ON public.memory_gallery_comments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view likes" ON public.memory_gallery_likes;
CREATE POLICY "Authenticated users can view likes"
  ON public.memory_gallery_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Notifications: only allow inserting a notification for oneself.
--    Cross-user notifications are created by edge functions via service_role.
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users can create their own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) reports_media storage: require the upload path to be inside the user's own folder.
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to reports media" ON storage.objects;
CREATE POLICY "Users can upload reports media to their own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports_media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
