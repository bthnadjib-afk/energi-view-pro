

# Audit P1–P11 — Résultat

## Matrice de couverture mise à jour

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MODULE          │ CREATE │ READ │ UPDATE │ DELETE │ VALIDATE │ EMAIL │ PDF  │
├─────────────────┼────────┼──────┼────────┼────────┼──────────┼───────┼──────┤
│ Clients         │  ✅    │  ✅  │  ✅    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Devis           │  ✅    │  ✅  │  ✅    │  ✅    │  ✅      │  ✅   │  ✅  │
│ Factures        │  ✅    │  ✅  │  ✅    │  ✅    │  ✅      │  ✅   │  ✅  │
│ Interventions   │  ✅    │  ✅  │  ✅    │  ✅    │  ✅      │  ✅   │  ✅  │
│ Produits        │  ✅    │  ✅  │  ✅    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Utilisateurs    │  ✅    │  ✅  │  ✅    │  ✅    │   N/A    │  N/A  │ N/A  │
│ Agenda          │  ✅    │  ✅  │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Dashboard       │  N/A   │  ✅  │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Config          │  N/A   │  ✅  │  ✅    │  N/A   │   N/A    │  N/A  │ N/A  │
│ Paiements       │  ✅    │  N/A │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Signatures      │  ✅    │  N/A │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
│ Devis→Facture   │  ✅    │  N/A │  N/A   │  N/A   │   N/A    │  N/A  │ N/A  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Résultat de l'audit point par point

| Point | Statut | Détail |
|-------|--------|--------|
| **P1** Interventions: données non envoyées | ✅ CORRIGÉ | `createIntervention` envoie `fk_user_assign`, `array_options.options_type`, `dateo/datee` (heures réelles), `note_private` |
| **P2** Interventions: PUT complet | ✅ CORRIGÉ | `updateIntervention` accepte `socid`, `dateo`, `datee`, `fk_user_assign`, `array_options` |
| **P3** Factures: UPDATE lignes brouillon | ✅ CORRIGÉ | Bouton "Modifier les lignes" visible sur factures `fk_statut === 0`, appelle `updateFactureLines` |
| **P4** Factures: paiement | ✅ CORRIGÉ | `addPayment()` → `POST /invoices/{id}/payments`. Bouton "Enregistrer un paiement" avec montant, date, mode |
| **P5** Utilisateurs: modification rôle/profil | ✅ CORRIGÉ | Bouton "Modifier" → met à jour nom + rôle dans Supabase + Dolibarr |
| **P6** Agenda: interactif | ✅ CORRIGÉ | Clic jour vide → dialog création pré-rempli. Clic intervention → detail |
| **P7** Signatures: persistées | ✅ CORRIGÉ | `saveInterventionSignatures` → `PUT /interventions/{id}` avec signature base64 dans `note_public` |
| **P8** Heures statiques | ✅ CORRIGÉ | `parseDolibarrTime(d.dateo)` / `parseDolibarrTime(d.datee)` remplace le hardcode, fallback `08:00`/`10:00` si absent |
| **P9** Devis: TVA 0% | ✅ CORRIGÉ | Default `tva_tx: 20` dans `Devis.tsx`. **⚠️ RESTE 2 occurrences à corriger** (voir ci-dessous) |
| **P10** Clients: projetsEnCours | ❌ NON CORRIGÉ | Toujours `projetsEnCours: 0` hardcodé dans `mapDolibarrClient` |
| **P11** Limite 100 résultats | ✅ CORRIGÉ | Toutes les requêtes GET utilisent `limit=500` |

## Problèmes résiduels à corriger (3 points)

### 1. TVA 0% dans `Interventions.tsx` (ligne 145)
Lors de la transformation d'une intervention en devis, `tva_tx: 0` est forcé. Doit être `tva_tx: 20`.

### 2. TVA 0% dans `Catalogue.tsx` (ligne 36)
Lors de la création d'un produit, `tva_tx: 0` est envoyé. Doit être `tva_tx: 20` (ou utiliser la TVA configurée).

### 3. `projetsEnCours` toujours à 0 (P10)
`mapDolibarrClient` force `projetsEnCours: 0` sans jamais calculer depuis les données Dolibarr.

## Plan de correction

| Fichier | Ligne | Correction |
|---------|-------|------------|
| `src/pages/Interventions.tsx` | 145 | `tva_tx: 0` → `tva_tx: 20` |
| `src/pages/Catalogue.tsx` | 36 | `tva_tx: 0` → `tva_tx: 20` |
| `src/services/dolibarr.ts` | 801 | Calculer `projetsEnCours` en comptant les devis/interventions actifs pour le client, ou laisser à 0 si non utilisé dans l'UI |

Corrections mineures, applicables en une passe.

