

## Plan Final — Build Complet ERP Dolibarr

Ce plan couvre l'ensemble du build : Edge Function proxy, connexion API réelle, pages Configuration et Utilisateurs, modules anti-collision, adresse et signature, plus le dashboard avancé et le workflow interventions.

### Séquence de Build

#### Étape 1 — Secrets & Edge Function Proxy

- Stocker `DOLIBARR_API_URL` et `DOLIBARR_API_KEY` comme secrets runtime
- Créer `supabase/functions/dolibarr-proxy/index.ts` : proxy générique qui reçoit `{ endpoint, method, data }`, ajoute le header `DOLAPIKEY`, relaye vers Dolibarr, renvoie la réponse avec CORS headers
- Refactorer `src/services/dolibarr.ts` pour appeler le proxy au lieu de Dolibarr directement, avec fallback mock data

#### Étape 2 — Page Configuration (Paramètres)

Nouvelle page `/configuration` avec 4 sections en onglets (style glassmorphism) :

- **Entreprise** : Nom, adresse (avec autocomplétion), SIRET, téléphone, email
- **Valeurs par défaut** : Taux TVA (défaut 20%), délai de paiement (30 jours), durée intervention (2h), taux horaire
- **Notifications** : Toggles pour alertes email (nouveau devis, intervention planifiée, facture en retard)
- **Dolibarr** : URL API et clé API (masquée), bouton "Tester la connexion", statut de connexion

Les valeurs sont persistées dans `localStorage` (et exposées via un hook `useConfig()` utilisé par les formulaires de création devis/intervention).

Les credentials Dolibarr saisis ici sont envoyés à l'Edge Function pour mise à jour des secrets (ou stockés côté client pour le proxy).

#### Étape 3 — Gestion Utilisateurs & Rôles

Nouvelle page `/utilisateurs` avec :

- Tableau des utilisateurs : Nom, Email, Rôle, Statut
- Bouton "Ajouter un utilisateur"
- 3 rôles avec contrôle d'accès côté frontend :

| Fonctionnalité | Admin | Secrétaire | Technicien |
|---|---|---|---|
| Dashboard (CA global) | ✅ | ❌ | ❌ |
| Configuration | ✅ | ❌ | ❌ |
| Factures | ✅ | ❌ | ❌ |
| Clients, Devis, Agenda | ✅ | ✅ | ❌ |
| Ses interventions | ✅ | ✅ | ✅ |
| Upload photos/signatures | ✅ | ✅ | ✅ |

- Hook `useCurrentUser()` qui retourne le rôle actuel
- Composant `<RoleGuard role="admin">` pour protéger les routes et éléments UI
- Sidebar adaptative : masque les liens selon le rôle
- Pour cette version : gestion locale (sans auth Supabase), avec un sélecteur de rôle pour tester

#### Étape 4 — Module Autocomplétion Adresse

- Composant `AddressAutocomplete.tsx` utilisant l'API **adresse.data.gouv.fr** (gratuite, pas de clé API nécessaire)
- Endpoint : `https://api-adresse.data.gouv.fr/search/?q=...`
- Remplit automatiquement : Rue, Code Postal, Ville
- Intégré dans : Config entreprise, formulaire client, formulaire intervention
- Dropdown stylé glassmorphism avec debounce 300ms

#### Étape 5 — Dashboard Avancé

- `PeriodSelector` : toggle Annuel/Mensuel/Hebdomadaire pour filtrer le CA
- Vue "Aujourd'hui" : interventions du jour groupées par technicien
- Widget "Urgences" : interventions SAV/Panne non traitées avec badge pulse rouge

#### Étape 6 — Workflow Interventions Complet

- Types d'intervention : sélecteur (Devis sur place, Panne, SAV, Chantier, Réalisation)
- Formulaire avec champs `heureDebut`/`heureFin`
- **Anti-collision** : `checkCollision()` vérifie les interventions existantes du technicien sur le créneau. Si conflit → `AlertDialog` bloquant
- Flux Avant/Pendant/Après avec notes et upload photo
- Boutons conversion : Intervention → Devis, Intervention → Facture

#### Étape 7 — Signature Client

- Composant `SignaturePad.tsx` : canvas tactile, boutons Effacer/Valider
- Capture en base64 PNG
- Intégré au formulaire fin d'intervention
- Inclus dans le Bon d'Intervention PDF (via jsPDF)

#### Étape 8 — Devis & Facturation

- Conversion Devis → Facture en un clic via proxy
- Lien signature électronique Dolibarr

### Fichiers à créer/modifier

| Fichier | Action |
|---|---|
| `supabase/functions/dolibarr-proxy/index.ts` | Créer |
| `src/services/dolibarr.ts` | Refactorer (proxy + mapping) |
| `src/pages/Configuration.tsx` | Créer |
| `src/pages/Utilisateurs.tsx` | Créer |
| `src/components/AddressAutocomplete.tsx` | Créer |
| `src/components/SignaturePad.tsx` | Créer |
| `src/components/CollisionAlert.tsx` | Créer |
| `src/components/InterventionForm.tsx` | Créer |
| `src/components/InterventionDetail.tsx` | Créer |
| `src/components/PeriodSelector.tsx` | Créer |
| `src/components/UrgencyWidget.tsx` | Créer |
| `src/components/RoleGuard.tsx` | Créer |
| `src/hooks/useConfig.ts` | Créer |
| `src/hooks/useCurrentUser.ts` | Créer |
| `src/components/AppSidebar.tsx` | Modifier (ajout Config, Utilisateurs, rôles) |
| `src/App.tsx` | Modifier (nouvelles routes) |
| `src/pages/Dashboard.tsx` | Modifier (dashboard avancé) |
| `src/pages/Interventions.tsx` | Modifier (workflow complet) |
| `src/pages/Clients.tsx` | Modifier (autocomplétion adresse) |

### Dépendances

- `jspdf` — génération PDF bon d'intervention

### Note technique — Adresse.data.gouv.fr

API gratuite française, aucune clé nécessaire. Retourne des résultats structurés (rue, code postal, ville, coordonnées GPS). Parfaitement adaptée pour une entreprise d'électricité en France.

