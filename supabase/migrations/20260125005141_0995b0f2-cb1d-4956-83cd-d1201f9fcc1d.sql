-- Create table for alert email recipients (usuarios de guardia)
CREATE TABLE public.alert_email_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_panic BOOLEAN NOT NULL DEFAULT true,
  notify_help_request BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.alert_email_recipients ENABLE ROW LEVEL SECURITY;

-- Only admins (SOS_ACTIVO) can manage alert recipients
CREATE POLICY "Admins can view alert recipients"
ON public.alert_email_recipients FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert alert recipients"
ON public.alert_email_recipients FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update alert recipients"
ON public.alert_email_recipients FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete alert recipients"
ON public.alert_email_recipients FOR DELETE
USING (public.is_admin(auth.uid()));

-- Add comment for documentation
COMMENT ON TABLE public.alert_email_recipients IS 'Lista de correos que reciben notificaciones de alertas de emergencia (usuarios de guardia)';