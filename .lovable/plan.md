

## Plan — Créer le premier utilisateur Admin

### Problème
La Edge Function `create-user` exige un appelant admin authentifié — c'est un problème d'oeuf et de poule pour le premier utilisateur.

### Solution
Créer une Edge Function temporaire `bootstrap-admin` qui :
- N'exige PAS d'authentification (utilisable une seule fois)
- Utilise le `SUPABASE_SERVICE_ROLE_KEY` pour créer l'utilisateur via `auth.admin.createUser`
- Crée l'utilisateur avec email `admin@electriciendugenevois.fr` et mot de passe `EDG@dmin0204`
- Insère le rôle `admin` dans `user_roles`
- Le trigger `handle_new_user` créera automatiquement le profil

### Étapes

1. **Déployer** `supabase/functions/bootstrap-admin/index.ts` — Edge Function one-shot qui crée l'utilisateur admin avec `auth.admin.createUser({ email, password, email_confirm: true })` (email pré-confirmé pour connexion immédiate)
2. **Appeler** la fonction via curl pour créer le compte
3. **Supprimer** la fonction après usage (sécurité)
4. **Vérifier** que le profil et le rôle sont bien en base

### Sécurité
- La fonction sera supprimée immédiatement après usage
- Le mot de passe sera hashé par Supabase Auth (jamais stocké en clair)
- `email_confirm: true` permet la connexion immédiate sans vérification email

### Fichiers
| Fichier | Action |
|---|---|
| `supabase/functions/bootstrap-admin/index.ts` | Créer (temporaire) |

