GRANT SELECT, INSERT ON public.mesh_relay TO authenticated;
GRANT ALL ON public.mesh_relay TO service_role;
GRANT SELECT, INSERT ON public.mesh_relay_acks TO authenticated;
GRANT ALL ON public.mesh_relay_acks TO service_role;