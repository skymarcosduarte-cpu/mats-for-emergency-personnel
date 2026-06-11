
-- Revoke EXECUTE on SECURITY DEFINER (and other) public functions from anon role
REVOKE EXECUTE ON FUNCTION public.get_users_within_radius(double precision, double precision, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_within_radius_of_request(uuid, double precision, double precision, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_within_radius_of_panic(uuid, double precision, double precision, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_community_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_recent_activity(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_todays_birthdays() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_nearby_birthdays() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_emergency_contacts(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_rescatista(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_sos_activo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ex_sos(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_avisos_moderator(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_report(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.unverify_report(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_users_within_radius(double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_within_radius_of_request(uuid, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_within_radius_of_panic(uuid, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_todays_birthdays() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_birthdays() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_emergency_contacts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rescatista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sos_activo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ex_sos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_avisos_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unverify_report(uuid) TO authenticated;
