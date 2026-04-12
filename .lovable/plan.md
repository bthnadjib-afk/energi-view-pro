

# Audit Complet — Branchement API Dolibarr ↔ ElectroPro

## Matrice de couverture actuelle

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MODULE          │ CREATE │ READ │ UPDATE │ DELETE │ VALIDATE │ EMAIL │ PDF  │
├─────────────────┼────────┼──────┼────────┼────────┼──────────┼───────┼──────┤
│ Clients         │  ✅    │  ✅  │  ✅    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Devis           │  ✅    │  ✅  │  ✅*   │  ✅    │  ✅      │  ✅   │  ✅  │
│ Factures        │  ✅    │  ✅  │  ❌    │  ✅    │  ✅      │  ✅   │  ✅  │
│ Interventions   │  ✅    │  ✅  │  ⚠️**  │  ✅    │  ✅      │  ✅   │  ✅  │
│ Produits        │  ✅    │  ✅  │  ✅    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Utilisateurs    │  ✅    │  ✅  │  ❌    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Agenda          │  N/A   │  ✅  │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Dashboard       │  N/A   │  ✅  │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Config          │  N/A   │  ✅  │  ✅    │  N/A   │   N/A    │  N/A  │ N/A  │
└─────────────────────────────────────────────────────────────────────────────┘

*  Devis UPDATE = lignes brouillon uniquement (updateDevisLines), fonctionne.
** Intervention UPDATE = description/notes (PUT), mais pas les champs tech/date/type.
```

## Problèmes identifiés — 12 points à corriger

### P1 — Interventions : Données non envoyées à l'API
- **Technicien** : Le champ `newTech` est sélectionné dans l'UI mais n'est **jamais envoyé** dans `createIntervention()`. L'API reçoit seulement `socid`, `description`, `date`. Le technicien n'est pas assigné.
- **Type** : `newType` (panne, SAV, chantier...) n'est **pas envoyé** non plus. Toujours mappé en dur à `'chantier'` dans `mapDolibarrIntervention`.
- **Heures** : `newHeureDebut` / `newHeureFin` ne sont **pas transmises** à Dolibarr.
- **Note privée** : `notePrivee` (admin) est capturée mais **pas envoyée** dans le body POST.

### P2 — Interventions : Pas de PUT complet
- `updateIntervention()` accepte seulement `description`, `note_public`, `note_private`. Impossible de modifier le client, le technicien, la date ou le type après création.

### P3 — Factures : Pas d'UPDATE (modifier lignes)
- `updateFactureLines()` existe dans `dolibarr.ts` mais **aucun bouton "Modifier"** n'est exposé dans l'UI de Factures.tsx. On ne peut pas modifier une facture brouillon.

### P4 — Factures : Pas de paiement
- Aucun endpoint pour enregistrer un paiement (`POST /invoices/{id}/payments`). La facture reste "Impayée" à jamais dans ElectroPro. Le champ `paye` n'est jamais modifiable.

### P5 — Utilisateurs : Pas de modification de rôle/profil
- Pas de bouton "Modifier" pour changer le rôle, le nom ou l'email d'un utilisateur existant. Impossible de promouvoir un technicien en admin ou de corriger un nom.

### P6 — Agenda : Lecture seule, aucune interaction
- L'Agenda affiche les interventions mais ne permet **aucune action** : pas de création en cliquant sur un jour, pas de drag & drop, pas de modification, pas de suppression. C'est un calendrier passif.

### P7 — Signatures : Non persistées
- Les signatures client/technicien capturées via `SignaturePad` sont stockées dans un `useState` local (`signatureData`, `signatureTechData`) mais **jamais envoyées** à Dolibarr ni sauvegardées en base. Elles sont perdues à la fermeture du dialog.

### P8 — Interventions : Heures statiques
- `heureDebut` et `heureFin` sont hardcodées à `'08:00'` et `'10:00'` dans `mapDolibarrIntervention`. Même si Dolibarr a les vraies heures, elles sont ignorées.

### P9 — Devis : TVA à 0% forcée
- Lors de la création d'un devis, `tva_tx` est forcé à `0` (ligne 345). Les factures utilisent `20%`. Incohérence.

### P10 — Clients : projetsEnCours toujours 0
- `mapDolibarrClient` force `projetsEnCours: 0`. Jamais calculé depuis les données Dolibarr.

### P11 — Limite de 100 résultats
- Toutes les requêtes GET ont `limit=100`. Au-delà de 100 clients/factures/devis, les données sont tronquées sans pagination.

### P12 — Factures : Pas de lien vers le devis source
- Quand on génère une facture depuis un devis (`createinvoice`), il n'y a aucun retour visuel reliant la facture au devis d'origine.

---

## Plan d'implémentation (par priorité)

### Étape 1 — Fix Interventions (P1 + P2 + P8)
- Modifier `createIntervention()` pour envoyer technicien (via `fk_user_assign` ou extrafield), type (extrafield `options_type`), heures (`dateo`/`datee` avec timestamp incluant l'heure), et note privée.
- Modifier `updateIntervention()` pour accepter tous les champs.
- Dans `mapDolibarrIntervention`, parser les heures depuis `dateo`/`datee` au lieu de hardcoder.
- Ajouter bouton "Modifier" sur le detail dialog.

### Étape 2 — Fix Factures (P3 + P4)
- Ajouter bouton "Modifier" sur factures brouillon, utilisant `updateFactureLines`.
- Ajouter bouton "Enregistrer un paiement" appelant `POST /invoices/{id}/payments` avec montant, date, mode de paiement.
- Ajouter `addPayment()` dans `dolibarr.ts` + hook `useAddPayment`.

### Étape 3 — Fix Utilisateurs (P5)
- Ajouter bouton "Modifier" (rôle, nom) sur chaque ligne utilisateur.
- Appel PUT Dolibarr pour mettre à jour les infos + UPDATE Supabase pour le rôle.

### Étape 4 — Signatures (P7)
- Envoyer la signature base64 en `PUT /interventions/{id}` (extrafield ou note) pour persister dans Dolibarr.
- Alternative : sauvegarder en storage Supabase avec lien vers l'intervention.

### Étape 5 — Devis TVA (P9)
- Utiliser la TVA du produit sélectionné au lieu de forcer `0`. Par défaut `20%` si ligne libre.

### Étape 6 — Agenda interactif (P6)
- Clic sur un jour → ouvre le dialog de création d'intervention pré-rempli avec la date.
- Clic sur une intervention dans le calendrier → ouvre le detail.

### Étape 7 — Améliorations secondaires (P10, P11, P12)
- Calculer `projetsEnCours` depuis les devis/interventions en cours.
- Ajouter pagination (ou augmenter la limite + bouton "Charger plus").
- Afficher la ref du devis source sur les factures converties.

---

### Fichiers impactés

| Fichier | Changements |
|---------|-------------|
| `src/services/dolibarr.ts` | `createIntervention` (champs manquants), `updateIntervention` (PUT complet), `addPayment`, parsing heures, TVA devis |
| `src/hooks/useDolibarr.ts` | `useAddPayment`, `useUpdateUser` hooks |
| `src/pages/Interventions.tsx` | Envoi tech/type/heures, bouton Modifier, parsing heures |
| `src/pages/Factures.tsx` | Bouton Modifier brouillon, bouton Paiement |
| `src/pages/Utilisateurs.tsx` | Bouton Modifier rôle/nom |
| `src/pages/Devis.tsx` | Fix TVA default 20% |
| `src/pages/Agenda.tsx` | Clic jour → création, clic intervention → detail |

