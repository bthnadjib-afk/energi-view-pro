import { createProduit, type Produit } from '@/services/dolibarr';

/**
 * Generate next reference for a new product based on existing ones.
 * - main_oeuvre (type === 1) → MO001, MO002...
 * - fourniture (type === 0)  → 0001, 0002...
 */
export function generateProductRef(produits: Produit[], productType: 0 | 1): string {
  if (productType === 1) {
    const refs = produits
      .filter(p => p.type === 'main_oeuvre')
      .map(p => {
        const m = p.ref.match(/MO(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      });
    const max = refs.length > 0 ? Math.max(...refs) : 0;
    return `MO${String(max + 1).padStart(3, '0')}`;
  }
  const refs = produits
    .filter(p => p.type === 'fourniture')
    .map(p => {
      const m = p.ref.match(/^(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const max = refs.length > 0 ? Math.max(...refs) : 0;
  return String(max + 1).padStart(4, '0');
}

export interface LigneCatalogPayload {
  desc: string;
  subprice: number;
  tva_tx: number;
  product_type: number; // 0 fourniture, 1 main d'œuvre
  productId?: string;
  prixAchat?: number;
  saveToCatalog?: boolean;
}

/**
 * For each line flagged with `saveToCatalog` and without an existing productId,
 * create the product in the Dolibarr catalog. Refs are generated locally with
 * a running offset to avoid collisions when several new products are created
 * at once. Errors are swallowed per-line so saving the document still succeeds.
 *
 * Returns the number of products successfully created.
 */
export async function persistLinesToCatalog(
  lines: LigneCatalogPayload[],
  produits: Produit[]
): Promise<number> {
  let createdMo = 0;
  let createdFourn = 0;
  let count = 0;

  for (const l of lines) {
    if (!l.saveToCatalog) continue;
    if (l.productId) continue;
    if (!l.desc?.trim()) continue;

    const productType = (l.product_type === 1 ? 1 : 0) as 0 | 1;

    // Compute next ref taking into account products created during this call.
    const baseRef = generateProductRef(produits, productType);
    let ref = baseRef;
    if (productType === 1) {
      const m = baseRef.match(/MO(\d+)/);
      const n = m ? parseInt(m[1], 10) : 1;
      ref = `MO${String(n + createdMo).padStart(3, '0')}`;
      createdMo += 1;
    } else {
      const n = parseInt(baseRef, 10) || 1;
      ref = String(n + createdFourn).padStart(4, '0');
      createdFourn += 1;
    }

    try {
      await createProduit({
        ref,
        label: l.desc.trim().slice(0, 255),
        price: l.subprice,
        tva_tx: l.tva_tx || 20,
        type: productType,
        cost_price: l.prixAchat || 0,
      });
      count += 1;
    } catch (e) {
      // Ignore — the document creation should not fail because of a catalog
      // duplicate or transient error.
      console.warn('[catalog] could not create product', ref, e);
    }
  }

  return count;
}
