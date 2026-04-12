

## Plan — Corrections securite, workflow devis, dashboard priorites, suivi client, fix interventions

### 1. Migration SQL — Fix RLS securite

Corriger les politiques trop permissives sur `email_history` :
- DROP les policies existantes (INSERT et SELECT)
- Nouvelle SELECT : `USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())`
- Nouvelle INSERT : `WITH CHECK (auth.uid() = user_id)`

Ajouter politique secretaire pour lecture email_templates :
- Ajouter SELECT policy pour secretaire en plus d'admin

### 2. Utilisateurs — Mot de passe + Suppression

**`supabase/functions/create-user/index.ts`** :
- Ajouter parametre `password` optionnel dans le body
- Si fourni, passer `password` a `adminClient.auth.admin.createUser()`
- Ajouter endpoint DELETE user : nouvelle edge function `delete-user` qui appelle `adminClient.auth.admin.deleteUser()` + supprime user_roles + profile

**`src/pages/Utilisateurs.tsx`** :
- Ajouter champ mot de passe dans le dialog de creation
- Ajouter bouton "Supprimer" sur chaque ligne (admin only) avec confirmation
- Appeler la nouvelle edge function pour supprimer

### 3. StatusBadge — Nouveaux statuts devis

**`src/components/StatusBadge.tsx`** :
- Ajouter `'brouillon'` → gris (`bg-gray-500/20 text-gray-400 border-gray-500/30`)
- Modifier `'en attente'` → reste bleu (= validé)
- `'accepté'` reste vert, `'refusé'` reste rouge

**`src/services/dolibarr.ts`** — `mapDolibarrDevis` :
- `fk_statut === '0'` → `'brouillon'`
- `fk_statut === '1'` → `'en attente'` (validé)
- `fk_statut === '2'` → `'accepté'`
- `fk_statut === '3'` → `'refusé'`

### 4. Devis — Recap HT/TTC temps reel + workflow ameliore

**`src/pages/Devis.tsx`** :
- Dans le dialog de creation, ajouter un bloc recap sous les lignes :
  - Total HT = somme(qty * subprice)
  - TVA = somme(qty * subprice * tva_tx / 100)
  - Total TTC = HT + TVA
- Boutons de statut conditionnel :
  - `brouillon` → "Valider" (POST validate)
  - `en attente` (= valide) → "Accepter (Signe)" / "Refuser"
  - `accepté` → "Convertir en Facture" / "Saisir acompte" (deja la)
- Apres signature + acceptation → toast proposant "Creer une facture d'acompte ?"

### 5. Dashboard — Section priorites + vue Aujourd'hui

**`src/pages/Dashboard.tsx`** :
- Ajouter section "A faire en priorite" avec 3 sous-blocs :
  - Devis en attente depuis > 7 jours (relances)
  - Factures impayees
  - Interventions planifiees non validees
- Ameliorer la vue "Aujourd'hui" existante avec les horaires et descriptions

### 6. Fiche Client — Historique centralise

**`src/pages/Clients.tsx`** :
- Ajouter un onglet "Historique" dans le detail client
- Fusionner : devis du client (from useDevis filtered by socid), interventions (from useInterventions filtered by socid), emails (from email_history)
- Trier par date decroissante, afficher type + ref + date + statut

### 7. Fix Interventions — Date, Technicien, Facture depuis terminé

**`src/services/dolibarr.ts`** — `mapDolibarrIntervention` :
- Extraire technicien depuis `d.array_options?.options_technicien` ou `d.user_author_id` (fallback vide)
- Mieux parser la date (deja fait mais verifier)

**`src/pages/Interventions.tsx`** :
- Bouton "Generer facture" visible seulement si `statut === 'terminé'`
- Cacher les boutons "Transformer en Devis/Facture" dans la liste inline quand pas pertinent

### 8. Edge Function — delete-user

Nouveau fichier `supabase/functions/delete-user/index.ts` :
- Verifie que le caller est admin (via getUser + user_roles check)
- Supprime le user via `adminClient.auth.admin.deleteUser(userId)`
- Les FK CASCADE suppriment automatiquement user_roles et profiles

### Fichiers impactes

| Fichier | Action |
|---|---|
| Migration SQL | Fix RLS email_history |
| `supabase/functions/create-user/index.ts` | Ajout password optionnel |
| `supabase/functions/delete-user/index.ts` | Nouveau — suppression user |
| `src/components/StatusBadge.tsx` | Ajout statut 'brouillon' gris |
| `src/services/dolibarr.ts` | Fix mapping devis statuts, intervention technicien |
| `src/pages/Utilisateurs.tsx` | Champ password + bouton supprimer |
| `src/pages/Devis.tsx` | Recap HT/TTC, workflow statuts, proposition acompte |
| `src/pages/Dashboard.tsx` | Section priorites, vue aujourd'hui |
| `src/pages/Clients.tsx` | Historique centralise (devis+interventions+emails) |
| `src/pages/Interventions.tsx` | Facture depuis terminé, fix boutons |

