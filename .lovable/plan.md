

# Audit complet — Onglet Catalogue

## Ce qui fonctionne

| Action | API Dolibarr | Status |
|--------|-------------|--------|
| Créer produit | `POST /products` | ✅ (async) |
| Modifier produit | `PUT /products/{id}` | ✅ (async) |
| Supprimer produit | `DELETE /products/{id}` | ⚠️ pas async |
| Affichage grille | Cards avec type/ref/prix | ✅ |
| Référence auto | MO001 / 0001 | ✅ |

## Problèmes identifiés

### P1 — Suppression utilise `mutate` au lieu de `mutateAsync`
Ligne 121 : `deleteProduitMutation.mutate(p.id)` dans le `AlertDialogAction`. Pas séquencé.

**Correction** : `await deleteProduitMutation.mutateAsync(p.id)`.

### P2 — Pas de recherche / filtre
Aucun filtre par type (Main d'œuvre / Fourniture) ni recherche texte (libellé, ref, description).

**Correction** : Ajouter `searchQuery` + `filterType` (Tous / Main d'œuvre / Fourniture).

### P3 — Pas de TVA modifiable en édition
Le formulaire de création envoie `tva_tx: 20` (fixe), et l'édition ne transmet pas du tout `tva_tx`. Si un produit a un taux différent, impossible de le modifier.

**Correction** : Ajouter un champ TVA dans les deux formulaires (création + édition), pré-rempli à 20%.

### P4 — Pas de prix d'achat (marge)
Le type `Produit` contient `prixAchat` et le mapping lit `cost_price`, mais ni le formulaire de création ni celui d'édition ne permettent de saisir le prix d'achat. La marge ne peut pas être gérée.

**Correction** : Ajouter un champ `prixAchat` dans les deux formulaires, et l'envoyer comme `cost_price` à Dolibarr.

### P5 — Référence auto potentiellement dupliquée
`generateRef` compte le nombre de produits existants du même type +1. Si un produit est supprimé au milieu, la référence va être dupliquée (ex: 3 produits MO001-MO003, on supprime MO002, le suivant sera MO003 → collision).

**Correction** : Extraire le max numérique des refs existantes +1 au lieu de compter.

### P6 — Édition ne permet pas de changer le type
Le dialog d'édition ne contient pas le `Select` de type. Si on a classé un produit en fourniture par erreur, impossible de corriger.

**Correction** : Ajouter le Select type dans le dialog d'édition.

## Plan de correction

### `src/pages/Catalogue.tsx`

1. **Suppression async** : `await deleteProduitMutation.mutateAsync(p.id)`
2. **Recherche + filtre type** : `searchQuery` + `filterType` avec Input + Select
3. **TVA modifiable** : champ TVA dans création et édition, envoyé à Dolibarr
4. **Prix d'achat** : champ `prixAchat` dans les deux formulaires
5. **Ref auto robuste** : max numérique des refs existantes +1
6. **Type en édition** : ajouter le Select type dans le dialog d'édition

### `src/services/dolibarr.ts`

1. Ajouter `cost_price` dans `createProduit` et `updateProduit`
2. Ajouter `tva_tx` dans `updateProduit`

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/pages/Catalogue.tsx` | Async suppression, recherche, filtres, TVA, prix d'achat, ref robuste, type en édition |
| `src/services/dolibarr.ts` | `cost_price` + `tva_tx` dans create/update produit |

## Comportement attendu de chaque action sur Dolibarr

| Action ElectroPro | Appel API | Effet Dolibarr |
|---|---|---|
| **Créer** | `POST /products` | Crée un produit/service (type 0=fourniture, 1=service). Ref unique obligatoire. status=1 (en vente), status_buy=1 (achetable). |
| **Modifier** | `PUT /products/{id}` | Met à jour label, description, prix, TVA, type, prix d'achat. |
| **Supprimer** | `DELETE /products/{id}` | Suppression définitive. Échoue si le produit est utilisé dans des lignes de devis/factures. |

