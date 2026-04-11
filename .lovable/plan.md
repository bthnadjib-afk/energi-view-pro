

## Dashboard ERP Électricité — Dolibarr Headless

### Vue d'ensemble
Un dashboard métier dark mode avec effets glassmorphism, connecté à l'API Dolibarr, pour gérer factures, devis et interventions d'une entreprise d'électricité.

### Structure & Pages

**1. Layout principal**
- Sidebar fine (collapsible) avec navigation : Dashboard, Factures, Devis, Interventions
- Header avec titre de page et SidebarTrigger
- Dark mode par défaut avec palette sombre (bg #0F172A, surfaces glass rgba blanc 5-10%)

**2. Page Dashboard (accueil)**
- 4 cartes statistiques avec dégradés (bleu, violet, vert, orange) et effets glass :
  - Chiffre d'Affaires (total factures)
  - Devis en attente (nombre)
  - Interventions planifiées (nombre)
  - Taux de conversion devis→factures
- Liste récente des interventions avec badges statut colorés (Planifié, En cours, Terminé, Annulé)

**3. Page Factures**
- Tableau avec colonnes : Référence, Client, Date, Montant TTC, Statut
- Cartes résumé en haut (total CA, factures payées, impayées)

**4. Page Devis**
- Tableau : Référence, Client, Date, Montant TTC, Statut, Badge Acompte
- **Règle métier** : Montant TTC > 5000€ → badge "Acompte 30% requis" (vert), sinon → "Acompte 50% requis" (orange)
- Détail devis avec lignes : Désignation, Quantité, Prix Unitaire, Total HT

**5. Page Interventions**
- Tableau/liste avec badges statut colorés
- **Filtres** : par technicien (select) et par statut (select/toggle)
- Colonnes : Référence, Client, Technicien, Date, Statut

### Design
- Glassmorphism : `backdrop-blur-xl`, bordures semi-transparentes, bg `white/5`
- Dégradés sur les cartes stats (blue-500→indigo-600, violet-500→purple-600, etc.)
- Badges colorés par statut avec opacité
- 100% responsive (grille adaptive, tableau scrollable sur mobile)

### Architecture technique
- Service API (`src/services/dolibarr.ts`) avec base URL et API key configurables, fonctions fetch pour chaque endpoint
- Données fictives réalistes (clients électricité, interventions type) pour le rendu initial
- Hook `useDolibarr` pour basculer facilement entre mock et API réelle
- React Query pour le data fetching

### Données fictives
Données réalistes : clients type (particuliers, copropriétés), interventions électriques (mise aux normes, dépannage, installation tableau), devis avec lignes détaillées.

