

# Correction: Double création Dolibarr

## Cause racine

La création Dolibarr se fait **deux fois** :
1. **Edge Function `create-user`** (lignes 109-144) : crée l'utilisateur Dolibarr côté serveur et persiste `dolibarr_user_id` dans `profiles` via `adminClient`.
2. **`Utilisateurs.tsx`** (lignes 106-110) : après le retour de l'Edge Function, appelle `dolibarrUserMutation.mutateAsync()` qui re-tente un `POST /users` côté client → erreur "existe déjà".

## Corrections

### 1. Supprimer l'appel client-side redondant (`Utilisateurs.tsx`)
Retirer les lignes 102-110 (le `try { await dolibarrUserMutation.mutateAsync(...) }`) car l'Edge Function gère déjà la synchro Dolibarr + la persistance de `dolibarr_user_id`.

### 2. Edge Function : fallback si l'utilisateur existe déjà
Dans `create-user/index.ts`, si le `POST /users` retourne une erreur "existe déjà", faire un `GET /users?sqlfilters=login='{login}'` pour récupérer l'ID existant et le persister dans `profiles` quand même.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/pages/Utilisateurs.tsx` | Supprimer lignes 102-110 (double appel Dolibarr) |
| `supabase/functions/create-user/index.ts` | Ajouter fallback GET si POST échoue avec "existe déjà" |

