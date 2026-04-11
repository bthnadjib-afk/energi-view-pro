

## Plan — Authentification Supabase & Gestion des Utilisateurs

### Situation actuelle
- Authentification = mock (localStorage avec rôle en dur)
- Aucune table dans la base de données
- Aucun système de login/session

### Ce qui sera construit

#### 1. Base de données — 2 tables + trigger

**Table `profiles`** (liée à `auth.users`) :
- `id` (uuid, FK → auth.users ON DELETE CASCADE)
- `nom` (text)
- `email` (text)
- `actif` (boolean, default true)
- `created_at` (timestamptz)

**Table `user_roles`** (table de rôles séparée, sécurité) :
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users ON DELETE CASCADE)
- `role` (enum `app_role` : admin, secretaire, technicien)
- Contrainte unique sur (user_id, role)

**Fonction `has_role`** : SECURITY DEFINER pour vérifier les rôles sans récursion RLS.

**Trigger** : Auto-création du profil à l'inscription (`handle_new_user`).

**RLS** : Les utilisateurs lisent tous les profils, modifient uniquement le leur. Admins gèrent les rôles.

#### 2. Edge Function — `create-user`

Nouvelle Edge Function qui utilise le `service_role_key` pour :
- Créer l'utilisateur via `supabase.auth.admin.createUser()` avec `email_confirm: false` (l'utilisateur reçoit un email de confirmation)
- Insérer le rôle dans `user_roles`
- Accessible uniquement par un admin authentifié

#### 3. Page Login (`/login`)

- Formulaire Email + Mot de passe (style glassmorphism dark)
- Lien "Mot de passe oublié" → appel `resetPasswordForEmail`
- Redirection vers `/` après connexion

#### 4. Page Reset Password (`/reset-password`)

- Formulaire nouveau mot de passe
- Détecte le token `type=recovery` dans l'URL
- Appel `updateUser({ password })`

#### 5. Refonte `useCurrentUser` → `useAuth`

- Remplace les mock users par des requêtes Supabase (`auth.getSession`, `onAuthStateChange`)
- Charge le profil + rôle depuis `profiles` et `user_roles`
- Expose : `user`, `profile`, `role`, `signOut`, `canAccess`, `loading`
- Session persistée automatiquement par Supabase (localStorage)

#### 6. Protection des routes (`App.tsx`)

- Si non connecté → affiche Login
- Si connecté → affiche le layout avec sidebar
- `onAuthStateChange` écoute les changements de session

#### 7. Page Utilisateurs — fonctionnelle

- "Ajouter un utilisateur" appelle l'Edge Function `create-user`
- Liste chargée depuis `profiles` + `user_roles`
- L'admin peut modifier le rôle ou désactiver un utilisateur

#### 8. Profil utilisateur

- Bouton dans la sidebar/header pour accéder à son profil
- Possibilité de changer son mot de passe (`updateUser`)

### Fichiers impactés

| Fichier | Action |
|---|---|
| Migration SQL | Créer `profiles`, `user_roles`, enum, trigger, RLS |
| `supabase/functions/create-user/index.ts` | Créer |
| `src/pages/Login.tsx` | Créer |
| `src/pages/ResetPassword.tsx` | Créer |
| `src/hooks/useAuth.ts` | Créer (remplace useCurrentUser) |
| `src/App.tsx` | Modifier (auth guard, nouvelles routes) |
| `src/pages/Utilisateurs.tsx` | Modifier (appels API réels) |
| `src/components/AppSidebar.tsx` | Modifier (bouton déconnexion, profil) |

### Sécurité

- Rôles stockés dans une table séparée (jamais dans profiles)
- Fonction `has_role` en SECURITY DEFINER
- Création d'utilisateurs via Edge Function service_role (jamais côté client)
- RLS stricte sur toutes les tables
- Auto-confirm email desactivé (l'utilisateur doit vérifier son email)

