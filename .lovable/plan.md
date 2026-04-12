

# Audit Factures — Branchements existants et manquants

## Ce qui fonctionne déjà

| Action | API Dolibarr | UI | Status |
|--------|-------------|-----|--------|
| Créer facture brouillon | `POST /invoices` | Dialog + lignes | ✅ |
| Supprimer brouillon | `DELETE /invoices/{id}` | AlertDialog, fk_statut===0 | ✅ |
| Valider facture | `POST /invoices/{id}/validate` | Bouton dans detail | ✅ |
| Enregistrer paiement | `POST /invoices/{id}/payments` | Dialog paiement | ✅ |
| Modifier lignes brouillon | `PUT /invoices/{id}` | Dialog edit lines | ✅ |
| Voir PDF | `PUT /documents/builddoc` | Bouton PDF | ✅ |
| Envoyer par email | `POST /invoices/{id}/sendByEmail` | Dialog email | ✅ |
| Liste + stats | `GET /invoices` | Table + StatCards | ✅ |

## Problèmes identifiés

### 1. Pas de rafraîchissement live après validation/paiement
Quand on valide une facture (`validateFactureMutation.mutate`), le `onSuccess` du mutation ferme le dialog (`setSelectedFacture(null)`) **mais** le cache React Query est invalidé en parallèle. La facture dans `selectedFacture` locale n'est pas mise à jour → si l'utilisateur re-clique avant le refetch, il voit l'ancien statut. 

**Correction** : Après validation/paiement, fermer le dialog ET attendre l'invalidation. Utiliser `mutateAsync` + `await` pour séquencer.

### 2. Paiement utilise `montantTTC` pour `closepaidinvoices` mais `amount` est libre
L'utilisateur peut modifier le montant, mais la comparaison `paymentAmount >= selectedFacture.montantTTC` ne tient pas compte des paiements partiels précédents (le `reste_a_payer` de Dolibarr n'est pas récupéré).

**Correction** : Ajouter `reste_a_payer` au type `Facture` et au mapping, puis l'utiliser pour pré-remplir le montant et déterminer si `closepaidinvoices = 'yes'`.

### 3. Facture type `Facture` n'a pas de `lignes` — l'éditeur de brouillon charge un placeholder
Ligne 112 : `setEditLines([{ desc: 'Chargement...', ...}])`. Les vraies lignes ne sont pas récupérées depuis Dolibarr.

**Correction** : Ajouter `lignes` au type `Facture`, les mapper depuis `d.lines` dans `mapDolibarrFacture`, et les charger dans l'éditeur.

### 4. Pas de filtre/recherche sur la liste
Contrairement aux Interventions qui ont des filtres, les Factures n'ont aucun filtre (par client, statut, période).

**Correction** : Ajouter des filtres basiques (statut, client, recherche texte).

### 5. Le statut Dolibarr `fk_statut=2` (Payée partiellement) n'est pas géré
`getFactureStatutLabel` ne retourne que "Brouillon", "Impayée" ou "Payée". Dolibarr a aussi un statut intermédiaire quand un paiement partiel est enregistré.

**Correction** : Enrichir `getFactureStatutLabel` avec les vrais statuts Dolibarr (0=Brouillon, 1=Validée non payée, 2=Payée partiellement — via `sumpayed`, 3=Abandonnée).

## Plan de correction

### Fichier `src/services/dolibarr.ts`

1. **Enrichir le type `Facture`** : ajouter `lignes: DevisLigne[]`, `resteAPayer: number`, `totalPaye: number`
2. **Enrichir `mapDolibarrFacture`** : mapper `d.lines`, `d.remaintopay`, `d.sumpayed`
3. **Enrichir `getFactureStatutLabel`** : gérer les paiements partiels (`fk_statut >= 1 && !paye && totalPaye > 0` → "Partiellement payée")

### Fichier `src/pages/Factures.tsx`

1. **Validation** : remplacer `validateFactureMutation.mutate(id, { onSuccess })` par `await validateFactureMutation.mutateAsync(id)` puis `setSelectedFacture(null)`
2. **Paiement** : pré-remplir avec `resteAPayer` au lieu de `montantTTC`, utiliser `closepaidinvoices = resteAPayer - paymentAmount <= 0.01 ? 'yes' : 'no'`
3. **Éditeur brouillon** : charger les vraies lignes depuis `selectedFacture.lignes` au lieu du placeholder
4. **Filtres** : ajouter un filtre par statut (Tous/Brouillon/Impayée/Payée) et une recherche par ref/client
5. **Bouton "Classer abandonnée"** : pour les factures validées impayées, ajouter une action Dolibarr `POST /invoices/{id}/setnopaid` ou `PUT` avec fk_statut=3

### Fichier `src/components/StatusBadge.tsx`

Vérifier que "Partiellement payée" a une couleur distincte (orange).

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/services/dolibarr.ts` | Type Facture + mapping lignes/resteAPayer + statut labels enrichis |
| `src/pages/Factures.tsx` | Séquençage async, filtres, lignes réelles, pré-remplissage paiement |
| `src/components/StatusBadge.tsx` | Couleur "Partiellement payée" |

## Comportement attendu de chaque action sur Dolibarr

| Action ElectroPro | Appel API Dolibarr | Effet dans Dolibarr |
|---|---|---|
| **Créer facture** | `POST /invoices` avec socid + lines | Crée une facture en **brouillon** (fk_statut=0). Pas de numérotation définitive. |
| **Modifier lignes** | `PUT /invoices/{id}` avec lines | Remplace les lignes de la facture brouillon. Seul fk_statut=0 est modifiable. |
| **Valider** | `POST /invoices/{id}/validate` | Passe la facture en **validée** (fk_statut=1). Attribue un numéro définitif (ex: FA2504-0001). Irréversible. |
| **Enregistrer paiement** | `POST /invoices/{id}/payments` | Crée un règlement dans Dolibarr. Si `closepaidinvoices=yes`, passe paye=1. Sinon la facture reste en "partiellement payée". |
| **Voir PDF** | `PUT /documents/builddoc` modulepart=facture | Génère le PDF côté serveur Dolibarr avec le template choisi (crabe). Retourne le fichier en base64. |
| **Envoyer email** | `POST /invoices/{id}/sendByEmail` | Dolibarr envoie le mail via son SMTP configuré avec le PDF en PJ. |
| **Supprimer** | `DELETE /invoices/{id}` | Supprime définitivement la facture. Uniquement possible sur les brouillons (fk_statut=0). |

