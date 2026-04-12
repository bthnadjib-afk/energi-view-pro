

# Audit complet — Onglet Interventions

## Ce qui fonctionne

| Action | API Dolibarr | Status |
|--------|-------------|--------|
| Créer intervention brouillon | `POST /interventions` | ✅ |
| Supprimer brouillon | `DELETE /interventions/{id}` | ✅ |
| Valider | `POST /interventions/{id}/validate` | ✅ |
| Démarrer (En cours) | `POST /interventions/{id}/close` status=2 | ✅ |
| Terminer | `POST /interventions/{id}/close` status=3 | ✅ |
| Transformer en Devis | `POST /proposals` | ✅ |
| Générer Facture | `POST /invoices` | ✅ |
| Anti-collision planning | `checkCollision()` | ✅ |
| Voir PDF | `PUT /documents/builddoc` ficheinter | ✅ |
| Envoyer email | `sendInterventionByEmail` | ✅ |
| Filtres (technicien/statut/type) | — | ✅ |
| Signatures client + technicien | `useSaveSignatures` | ✅ |
| Note privée admin | `note_private` | ✅ |

## Problèmes identifiés

### P1 — Pas de rafraîchissement live après validation/démarrage/terminaison
Lignes 410, 432, 438 : `validateMutation.mutate(id, { onSuccess })` et `closeMutation.mutate(...)` utilisent `mutate` avec un callback `onSuccess` qui ferme le dialog. Mais le cache React Query est invalidé en parallèle dans le hook. Si l'utilisateur rouvre le détail avant le refetch, il voit l'ancien statut.

**Correction** : `await mutateAsync(...)` puis `setDetailOpen(false)`.

### P2 — Suppression et transformation ne sont pas `await`
Ligne 424 : `deleteMutation.mutate(id); setDetailOpen(false)` — pas séquencé. Idem pour `handleTransformDevis` et `handleTransformFacture` qui sont async mais appelés via `onClick` direct dans les actions de table (lignes 318, 323) sans `await` et avec un bug : `setSelectedIntervention(i)` suivi immédiatement de `handleTransformDevis()` — mais `selectedIntervention` n'est pas encore mis à jour (setState est async).

**Correction** : Passer l'intervention en paramètre aux fonctions de transformation au lieu de dépendre de `selectedIntervention`.

### P3 — Pas de recherche texte
Contrairement aux Factures et Devis corrigés, pas de barre de recherche par ref/client.

**Correction** : Ajouter un `searchQuery` filtrant par ref et client.

### P4 — Pas d'édition d'intervention existante (brouillon)
`useUpdateIntervention` est importé dans `useDolibarr.ts` mais jamais utilisé dans la page. Un brouillon ne peut pas être modifié (description, technicien, horaires, type).

**Correction** : Ajouter un bouton "Modifier" dans le détail pour les brouillons (fk_statut=0), ouvrant un dialog d'édition pré-rempli.

### P5 — Signatures utilisent `mutate` au lieu de `mutateAsync`
Lignes 388, 398 : `saveSignaturesMutation.mutate(...)` sans await. Le toast "Signature enregistrée" s'affiche avant la confirmation Dolibarr.

**Correction** : `await saveSignaturesMutation.mutateAsync(...)`.

## Plan de correction

### `src/pages/Interventions.tsx`

1. **Async séquencé** : remplacer tous les `.mutate()` par `await .mutateAsync()` pour valider, démarrer, terminer, supprimer, signatures
2. **Bug transformation** : passer l'intervention en paramètre à `handleTransformDevis(inter)` et `handleTransformFacture(inter)` au lieu de dépendre de `selectedIntervention`
3. **Recherche texte** : ajouter `searchQuery` + input de recherche, filtrant par `ref` et `client`
4. **Édition brouillon** : ajouter un dialog de modification pour fk_statut=0 (description, technicien, type, date, horaires) utilisant `useUpdateIntervention`
5. **Importer useUpdateIntervention** dans la page

### `src/services/dolibarr.ts`

Aucune modification nécessaire — le type `Intervention` et `updateIntervention` existent déjà.

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/pages/Interventions.tsx` | Séquençage async, recherche texte, édition brouillon, fix transformation |

## Comportement attendu de chaque action sur Dolibarr

| Action ElectroPro | Appel API | Effet Dolibarr |
|---|---|---|
| **Créer** | `POST /interventions` | Brouillon (fk_statut=0). Ref provisoire. |
| **Modifier** | `PUT /interventions/{id}` | Met à jour description, technicien, horaires. Brouillons uniquement. |
| **Valider** | `POST /interventions/{id}/validate` | Passe en Validée (fk_statut=1). Ref définitive. |
| **Démarrer** | `POST /interventions/{id}/close` status=2 | Passe en En cours (fk_statut=2). |
| **Terminer** | `POST /interventions/{id}/close` status=3 | Passe en Terminée (fk_statut=3). Irréversible. |
| **Transformer Devis** | `POST /proposals` | Crée un devis brouillon avec la description de l'intervention. |
| **Générer Facture** | `POST /invoices` | Crée une facture brouillon depuis l'intervention terminée. |
| **Signatures** | `PUT /interventions/{id}` array_options | Stocke les signatures base64 dans les champs extrafields Dolibarr. |
| **PDF** | `PUT /documents/builddoc` ficheinter | Génère le PDF template "soleil" côté Dolibarr. |
| **Email** | `POST /interventions/{id}/sendByEmail` | Envoie via SMTP Dolibarr avec PDF en PJ. |
| **Supprimer** | `DELETE /interventions/{id}` | Suppression définitive. Brouillons uniquement. |

