-- Table des lots / gabarits de devis
CREATE TABLE IF NOT EXISTS product_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  lines       JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent lire et gérer les lots
CREATE POLICY "authenticated_read_product_groups"
  ON product_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_product_groups"
  ON product_groups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_product_groups"
  ON product_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_product_groups"
  ON product_groups FOR DELETE TO authenticated USING (true);
