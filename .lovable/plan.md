

# Correction: Synchronisation Utilisateurs ElectroPro ↔ Dolibarr

## Problèmes identifiés

### 1. Création — `dolibarr_user_id` jamais persisté
Dans `Utilisateurs.tsx` ligne 105, `dolibarrUserMutation.mutate(...)` est appelé en **fire-and-forget** : le dialog se ferme et `fetchUsers()` est appelé **avant** que la mutation Dolibarr ne termine. Le hook `useCreateDolibarrUser` tente de mettre à jour `profiles.dolibarr_user_id` via `.eq('email', data.email)`, mais cela échoue silencieusement car la **politique RLS** sur `profiles` ne permet à un utilisateur que de mettre à jour **son propre profil** (`auth.uid() = id`). L'admin qui crée l'utilisateur n'est pas le propriétaire du profil cible → UPDATE bloqué par RLS → `dolibarr_user_id` reste `null`.

**Preuve** : Dans les données réseau, le profil admin a `"dolibarr_user_id": null`.

### 2. Suppression — Edge Function dépend de `dolibarr_user_id` 
L'Edge Function `delete-user` cherche `dolibarr_user_id` dans `profiles`. Comme il est toujours `null` (problème #1), elle fait un fallback par email. Mais l'email du profil Supabase ne correspond pas forcément au login Dolibarr, donc l'utilisateur Dolibarr n'est jamais trouvé ni supprimé.

## Corrections

### A. RLS — Permettre aux admins de mettre à jour les profils
Ajouter une politique RLS `UPDATE` sur `profiles` pour les admins :
```sql
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### B. Création — Attendre la synchro Dolibarr avant de fermer
Dans `Utilisateurs.tsx`, remplacer le `mutate` fire-and-forget par `mutateAsync` avec `await`, pour que `dolibarr_user_id` soit persisté avant le refresh :
```typescript
try {
  await dolibarrUserMutation.mutateAsync({ login, firstname, lastname, email });
} catch { /* non-bloquant */ }
setDialogOpen(false);
fetchUsers();
```

### C. Edge Function `create-user` — Persister `dolibarr_user_id` côté serveur
Alternative plus robuste : dans l'Edge Function `create-user`, après la création Supabase, appeler directement l'API Dolibarr `POST /users` avec le `DOLIBARR_API_KEY` serveur, puis stocker le `dolibarr_user_id` retourné dans `profiles` via le `adminClient` (qui bypass RLS). Cela garantit la synchro même si le client plante.

### D. Edge Function `delete-user` — Améliorer le fallback
Actuellement le fallback cherche par email. Ajouter aussi une recherche par login (`email.split('@')[0]`) au cas où l'email ne matche pas.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Ajouter politique RLS admin UPDATE sur `profiles` |
| `supabase/functions/create-user/index.ts` | Appeler Dolibarr `POST /users` + stocker `dolibarr_user_id` dans profiles |
| `src/pages/Utilisateurs.tsx` | `mutate` → `mutateAsync` avec await |
| `supabase/functions/delete-user/index.ts` | Fallback recherche par login en plus de l'email |

