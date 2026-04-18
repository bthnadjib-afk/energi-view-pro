-- Table des fournisseurs à scanner
CREATE TABLE public.sourcing_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  frequence TEXT NOT NULL DEFAULT 'manuel', -- manuel | quotidien | hebdomadaire | mensuel
  actif BOOLEAN NOT NULL DEFAULT true,
  derniere_execution TIMESTAMPTZ,
  dernier_statut TEXT, -- success | error | running | null
  dernier_message TEXT,
  nb_articles_detectes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sourcing_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent tous les fournisseurs sourcés"
  ON public.sourcing_suppliers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secrétaires peuvent voir les fournisseurs sourcés"
  ON public.sourcing_suppliers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaire'::app_role));

-- Table des articles scannés en attente d'import
CREATE TABLE public.sourcing_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.sourcing_suppliers(id) ON DELETE CASCADE,
  ref_externe TEXT,
  designation TEXT NOT NULL,
  description TEXT,
  prix_fournisseur NUMERIC(12, 2),
  devise TEXT DEFAULT 'EUR',
  url_produit TEXT,
  url_image TEXT,
  stock_dispo TEXT,
  importe BOOLEAN NOT NULL DEFAULT false,
  importe_at TIMESTAMPTZ,
  importe_product_id TEXT, -- id Dolibarr du produit créé
  scan_batch_id UUID, -- regroupe les articles d'un même scan
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sourcing_items_supplier ON public.sourcing_items(supplier_id);
CREATE INDEX idx_sourcing_items_importe ON public.sourcing_items(importe);

ALTER TABLE public.sourcing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent tous les articles scannés"
  ON public.sourcing_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secrétaires peuvent voir les articles scannés"
  ON public.sourcing_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaire'::app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sourcing_suppliers_updated
  BEFORE UPDATE ON public.sourcing_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();