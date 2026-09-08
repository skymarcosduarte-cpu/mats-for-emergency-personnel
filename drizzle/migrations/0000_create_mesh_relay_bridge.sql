-- Puente por Internet para la Red Mesh: repite mensajes entre "islas" Bluetooth
CREATE TABLE public.mesh_relay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_key text NOT NULL UNIQUE,
  sender_id uuid NOT NULL,
  origin text NOT NULL,
  type text NOT NULL,
  lat double precision,
  lng double precision,
  note text,
  hops integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX mesh_relay_created_idx ON public.mesh_relay (created_at DESC);

GRANT SELECT, INSERT ON public.mesh_relay TO authenticated;
GRANT ALL ON public.mesh_relay TO service_role;

ALTER TABLE public.mesh_relay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen mensajes mesh vigentes"
  ON public.mesh_relay FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "Usuarios publican sus mensajes mesh"
  ON public.mesh_relay FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Acuses de entrega: confirman que otro teléfono recibió el mensaje
CREATE TABLE public.mesh_relay_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_key text NOT NULL,
  user_id uuid NOT NULL,
  via text NOT NULL DEFAULT 'internet',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (msg_key, user_id)
);

CREATE INDEX mesh_relay_acks_key_idx ON public.mesh_relay_acks (msg_key);

GRANT SELECT, INSERT ON public.mesh_relay_acks TO authenticated;
GRANT ALL ON public.mesh_relay_acks TO service_role;

ALTER TABLE public.mesh_relay_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen acuses mesh"
  ON public.mesh_relay_acks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios registran su acuse mesh"
  ON public.mesh_relay_acks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_relay;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_relay_acks;