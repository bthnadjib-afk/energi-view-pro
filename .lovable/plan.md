

## Plan — Fix bugs critiques + Enrichissements (Client names, Catalogue POST, Select Produit, Conversion Devis, Notes privées)

### Analyse des problèmes

1. **"Client #16"** : `mapDolibarrFacture/Devis/Intervention` tombent sur le fallback `Client #${d.socid}` car Dolibarr ne renvoie pas toujours `thirdparty.name`. Solution : charger le cache clients et résoudre les noms après le fetch.
2. **Catalogue sans POST** : aucune fonction `createProduit` ni dialog de création.
3. **Lignes Devis/Factures = texte libre** : pas de Select produit, pas d'auto-fill prix/TVA/type.
4. **Conversion Devis → Facture** : `convertDevisToFacture()` existe dans le service mais jamais appelé depuis l'UI.
5. **Intervention 500** : `createIntervention` envoie `fk_soc` au lieu de `socid` (Dolibarr rejette).
6. **Notes privées + Signature technicien** : absents du formulaire intervention.
7. **`manage-config` getClaims** : `getClaims()` n'existe pas dans le SDK Supabase JS v2 — doit utiliser `getUser()`.

### Modifications

#### 1. `src/services/dolibarr.ts`

- **Fix `createIntervention`** : remplacer `fk_soc` par `socid` dans le body POST
- **Ajouter `createProduit()`** : POST `/products` avec `{ ref, label, description, price, tva_tx, type }`
- **Ajouter résolution noms clients** dans `fetchFactures`, `fetchDevis`, `fetchInterventions` : après le mapping, charger `fetchClients()` et remplacer `Client #XX` par le vrai nom via le `socid`
- **Enrichir `LigneForm`** avec `product_type` (0=produit, 1=service)

#### 2. `src/hooks/useDolibarr.ts`

- Ajouter `useCreateProduit()` mutation
- Ajouter `useConvertDevisToFacture()` mutation → invalidate `['devis', 'factures']`

#### 3. `src/pages/Catalogue.tsx`

- Ajouter bouton "Ajouter produit/service" + Dialog avec formulaire (ref, label, description, prix HT, TVA, type)
- Appeler `useCreateProduit().mutateAsync()`

#### 4. `src/pages/Factures.tsx` + `src/pages/Devis.tsx`

- Remplacer `<Input placeholder="Désignation">` par un `<Select>` alimenté par `useProduits()`
- Afficher **"[REF] — Libellé"** dans chaque option
- Au changement : auto-remplir `subprice`, `tva_tx`, et ajouter `product_type`
- Garder possibilité de saisie libre (option "Ligne libre" en tête de liste)

#### 5. `src/pages/Devis.tsx` — Actions conversion

- Dans `DevisDetail`, ajouter boutons :
  - "Convertir en Facture" (visible si `statut === 'accepté'`) → appelle `convertDevisToFacture(devisId)`
  - "Saisir un acompte" → crée une facture d'acompte (30% ou 50% selon montant)

#### 6. `src/pages/Interventions.tsx`

- **Fix POST** : le `socid` est déjà envoyé correctement côté UI, mais le service envoie `fk_soc` — corrigé dans dolibarr.ts
- **Notes privées** : ajouter un champ "Note privée (admin)" visible uniquement si `role === 'admin'` (via `useAuth()`)
- **Signature technicien** : ajouter un second `SignaturePad` dans le detail dialog avec label "Signature technicien"
- **Brancher boutons "Transformer"** : les boutons "Transformer en Devis" et "Transformer en Facture" dans le dialog de détail doivent appeler `createDevis`/`createFacture` avec les données de l'intervention

#### 7. `supabase/functions/manage-config/index.ts`

- Remplacer `getClaims(token)` par `getUser(token)` (le SDK v2 n'a pas `getClaims`)
- Extraire `userId` depuis `data.user.id`

### Fichiers impactés

| Fichier | Action |
|---|---|
| `src/services/dolibarr.ts` | Fix `createIntervention` (socid), +`createProduit`, +résolution noms clients |
| `src/hooks/useDolibarr.ts` | +`useCreateProduit`, +`useConvertDevisToFacture` |
| `src/pages/Catalogue.tsx` | Bouton + Dialog ajout produit |
| `src/pages/Factures.tsx` | Select produit dans lignes (REF + Libellé), auto-fill |
| `src/pages/Devis.tsx` | Select produit + boutons Convertir/Acompte dans DevisDetail |
| `src/pages/Interventions.tsx` | Note privée admin + signature technicien + brancher boutons transformer |
| `supabase/functions/manage-config/index.ts` | Fix getClaims → getUser |

### Points d'attention demandés

- Select produit affichera **`[REF] — Libellé`** pour éviter confusion
- Conversion Devis → Facture recopie les lignes à l'identique via l'endpoint Dolibarr `/proposals/{id}/createinvoice`
- Aucun changement sur `app_config` — la table et les données restent intactes

