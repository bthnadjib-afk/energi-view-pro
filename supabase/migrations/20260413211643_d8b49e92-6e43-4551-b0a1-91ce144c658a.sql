CREATE TABLE public.intervention_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id text NOT NULL,
  intervention_ref text,
  signature_client text,
  signature_tech text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(intervention_id)
);

ALTER TABLE public.intervention_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view signatures"
  ON public.intervention_signatures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert signatures"
  ON public.intervention_signatures FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update signatures"
  ON public.intervention_signatures FOR UPDATE TO authenticated
  USING (true);