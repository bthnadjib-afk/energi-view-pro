

# Audit complet — Onglet Devis

## Ce qui fonctionne

| Action | API Dolibarr | Status |
|--------|-------------|--------|
| Créer devis brouillon | `POST /proposals` | ✅ |
| Supprimer brouillon | `DELETE /proposals/{id}` | ✅ |
| Valider devis | `POST /proposals/{id}/validate` | ✅ |
| Classer signé/refusé | `POST /proposals/{id}/close` | ✅ |
| Convertir en facture | Conversion mutation | ✅ |
| Créer acompte | Acompte mutation | ✅ |
| Voir PDF | `PUT /documents/builddoc` propal | ✅ |
| Envoyer par email | `sendDevisByEmail` | ✅ |
| Lignes avec marges | Mapping `pa_ht` | ✅ |
| Signature client | `SignaturePad` | ✅ |

## Problèmes identifiés

### P1 — Pas de rafraîchissement live après validation/signature/refus
`validateMutation.mutate(devis.id)` et `closeMutation.mutate(...)` utilisent `mutate` sans `await`. Le statut dans `selectedFacture` locale n'est pas mis à jour immédiatement. L'utilisateur voit l'ancien statut s'il re-clique avant le refetch.

**Correction** : `mutateAsync` + `await` + fermer le détail expandé après succès.

### P2 — Pas de filtres ni recherche
Aucun filtre par statut, client ou recherche texte. Contrairement à Factures qui vient d'être corrigé.

**Correction** : Ajouter `filterStatut`, `filterClient`, `searchQuery` identiques à Factures.

### P3 — Pas d'éditeur de lignes pour brouillons existants
Le bouton "Modifier" (icône Pencil) n'existe pas dans `DevisDetail`. On peut seulement créer un nouveau devis, pas modifier les lignes d'un brouillon existant. Le hook `useUpdateDevis` est importé mais jamais utilisé dans le composant.

**Correction** : Ajouter un dialog d'édition de lignes dans `DevisDetail` pour les brouillons (`fk_statut === 0`), pré-rempli avec les lignes existantes.

### P4 — Conversion et acompte ne sont pas `await`
`onConvert={() => convertMutation.mutate(d.id)}` et `onAcompte(...)` utilisent `mutate` sans attendre. Pas de feedback séquencé.

**Correction** : Passer à `mutateAsync` avec try/catch.

### P5 — Pas de date de validité / fin de validité
Le type `Devis` ne contient pas `fin_validite` (champ Dolibarr `fin_validite`). Cette info est utile pour savoir si un devis est expiré.

**Correction** : Ajouter `finValidite` au type et au mapping, afficher un badge "Expiré" si la date est passée.

### P6 — `prixAchat` non transmis à Dolibarr lors de la création
Ligne 345 : les lignes envoyées à `createDevis` ne contiennent pas `pa_ht` (prix d'achat). La marge ne sera pas stockée côté Dolibarr.

**Correction** : Ajouter `pa_ht: l.prixAchat` dans le mapping des lignes envoyées.

## Plan de correction

### `src/services/dolibarr.ts`
1. Ajouter `finValidite: string` au type `Devis`
2. Mapper `d.fin_validite` dans `mapDolibarrDevis`
3. Vérifier que `CreateDevisLine` inclut `pa_ht`

### `src/pages/Devis.tsx`
1. **Async séquencé** : `validateMutation.mutate` → `await validateMutation.mutateAsync` + collapse expanded row
2. **Async pour close** : idem pour `closeMutation` (signé/refusé)
3. **Async pour convert/acompte** : `mutateAsync` avec try/catch
4. **Filtres** : ajouter `filterStatut` (Tous/Brouillon/Validé/Signé/Refusé/Facturé), `searchQuery`, `filterClient`
5. **Éditeur brouillon** : dialog de modification de lignes pour `fk_statut === 0`, pré-rempli avec `devis.lignes`, utilisant `useUpdateDevis`
6. **Prix d'achat** : ajouter `pa_ht: l.prixAchat` dans `handleCreate`
7. **Badge expiré** : afficher un indicateur si `finValidite < today`

### `src/components/StatusBadge.tsx`
Vérifier que "Facturé" a un style distinct (violet — déjà présent ✅).

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/services/dolibarr.ts` | Type Devis + mapping finValidite + CreateDevisLine pa_ht |
| `src/pages/Devis.tsx` | Séquençage async, filtres, éditeur brouillon, pa_ht, badge expiré |

## Comportement attendu de chaque action sur Dolibarr

| Action ElectroPro | Appel API | Effet Dolibarr |
|---|---|---|
| **Créer devis** | `POST /proposals` | Crée un brouillon (fk_statut=0). Ref provisoire. |
| **Modifier lignes** | `PUT /proposals/{id}` | Remplace les lignes. Uniquement fk_statut=0. |
| **Valider** | `POST /proposals/{id}/validate` | Passe en Validé (fk_statut=1). Ref définitive. Irréversible. |
| **Classer Signé** | `POST /proposals/{id}/close` status=2 | Passe en Signé (fk_statut=2). Permet conversion en facture. |
| **Classer Refusé** | `POST /proposals/{id}/close` status=3 | Passe en Refusé (fk_statut=3). Archivé. |
| **Convertir en facture** | Crée facture brouillon depuis le devis | Facture liée au devis dans Dolibarr. Devis passe en Facturé (fk_statut=4). |
| **Créer acompte** | `POST /invoices` type=3 | Facture d'acompte liée. |
| **Voir PDF** | `PUT /documents/builddoc` modulepart=propal | Génère PDF côté Dolibarr avec template azur. |
| **Envoyer email** | `POST /proposals/{id}/sendByEmail` | Mail via SMTP Dolibarr avec PDF en PJ. |
| **Supprimer** | `DELETE /proposals/{id}` | Suppression définitive. Brouillons uniquement. |

