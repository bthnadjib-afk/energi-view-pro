CREATE TABLE public.facture_relances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id TEXT NOT NULL UNIQUE,
  facture_ref TEXT NOT NULL,
  client_email TEXT,
  date_envoi TIMESTAMP WITH TIME ZONE,
  date_relance_1 TIMESTAMP WITH TIME ZONE,
  date_mise_en_demeure TIMESTAMP WITH TIME ZONE,
  statut_relance TEXT NOT NULL DEFAULT 'envoyee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view facture_relances"
  ON public.facture_relances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert facture_relances"
  ON public.facture_relances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update facture_relances"
  ON public.facture_relances FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete facture_relances"
  ON public.facture_relances FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_facture_relances_facture_id ON public.facture_relances(facture_id);
CREATE INDEX idx_facture_relances_statut ON public.facture_relances(statut_relance);