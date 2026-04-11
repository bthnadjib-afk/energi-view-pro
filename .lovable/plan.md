

## Plan — Écriture Dolibarr + Persistance Config + Dropdowns Clients + Dates

### Vue d'ensemble

8 fichiers modifiés/créés pour activer toute l'écriture vers Dolibarr, persister la config dans la base de données, et corriger les formulaires.

---

### 1. Table `app_config` dans la base de données (PRIORITE 1)

Migration SQL pour créer une table clé/valeur persistante :

```sql
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Seuls les admins peuvent lire/écrire
CREATE POLICY "Admins can manage config" ON public.app_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 2. Edge Function `manage-config`

Nouvelle fonction pour lire/écrire la config depuis le frontend :
- **GET** : retourne toutes les paires clé/valeur (admin only via JWT)
- **POST** : upsert des paires clé/valeur (admin only)
- Utilise `getClaims()` pour vérifier l'authentification
- Les credentials Dolibarr (URL, API Key) sont stockés ici, plus dans localStorage

### 3. `src/hooks/useConfig.ts` — Persistance Supabase

- Charger la config depuis l'Edge Function `manage-config` au montage (au lieu de localStorage)
- Sauvegarder via POST à l'Edge Function quand l'utilisateur clique "Sauvegarder"
- Garder localStorage comme cache local uniquement

### 4. `src/pages/Configuration.tsx` — Bouton Sauvegarder

- Ajouter un bouton "Sauvegarder les paramètres" qui persiste toute la config dans Supabase
- Toast de confirmation au succès

### 5. `src/services/dolibarr.ts` — Fonctions POST + helper date

**Nouvelles fonctions :**
- `createDevis(socid, lines[])` → POST `/proposals` avec `{ socid, date: timestamp, lines: [{ desc, qty, subprice, tva_tx }] }`
- `createFacture(socid, lines[])` → POST `/invoices` avec `{ socid, type: 0, date: timestamp, lines }`

**Corrections :**
- `createIntervention()` : envoyer `fk_soc: ID_NUMERIQUE` au lieu du nom texte
- `dolibarrCall()` pour les mutations : throw l'erreur au lieu de retourner `null` (pour que `useMutation.onError` fonctionne)

**Nouveau helper :**
- `formatDateFR(dateStr)` : retourne `DD/MM/YYYY` ou `'—'` si invalide

### 6. `src/hooks/useDolibarr.ts` — Mutations React Query

Ajouter 4 hooks `useMutation` :
- `useCreateClient()` → invalidate `['clients']` + `toast.success`
- `useCreateIntervention()` → invalidate `['interventions']`
- `useCreateDevis()` → invalidate `['devis']`
- `useCreateFacture()` → invalidate `['factures']`

### 7. Pages UI — Formulaires connectés

**`Interventions.tsx`** :
- Remplacer `<Input placeholder="Client">` par `<Select>` alimenté par `useClients()` (affiche nom, stocke ID)
- `handleCreate()` appelle `useCreateIntervention().mutateAsync()` avec le `socid`
- Dates affichées via `formatDateFR()`

**`Clients.tsx`** :
- Ajouter des states aux inputs (nom, ville, telephone, email, adresse, codePostal)
- Bouton "Enregistrer" appelle `useCreateClient().mutateAsync()` puis ferme le dialog

**`Factures.tsx`** :
- Ajouter bouton "Créer une facture" + Dialog avec `<Select>` client + zone lignes (designation, qté, prix, TVA)
- Bouton "Créer" appelle `useCreateFacture().mutateAsync()`
- Dates via `formatDateFR()`

**`Devis.tsx`** :
- Ajouter bouton "Créer un devis" + Dialog avec `<Select>` client + zone lignes
- Bouton "Créer" appelle `useCreateDevis().mutateAsync()`
- Dates via `formatDateFR()`

### Fichiers impactés

| Fichier | Action |
|---|---|
| Migration SQL | Table `app_config` + RLS admin |
| `supabase/functions/manage-config/index.ts` | Créer — CRUD config |
| `src/hooks/useConfig.ts` | Modifier — persistance Supabase |
| `src/pages/Configuration.tsx` | Modifier — bouton Sauvegarder |
| `src/services/dolibarr.ts` | +`createDevis`, +`createFacture`, fix `createIntervention`, +`formatDateFR`, throw errors |
| `src/hooks/useDolibarr.ts` | +4 mutations `useMutation` |
| `src/pages/Interventions.tsx` | Select client, POST réel, fix dates |
| `src/pages/Clients.tsx` | States inputs, POST réel |
| `src/pages/Factures.tsx` | Bouton Créer + Dialog + Select client + lignes |
| `src/pages/Devis.tsx` | Bouton Créer + Dialog + Select client + lignes |

### Payloads Dolibarr

```text
POST /thirdparties  → { name, address, zip, town, phone, email, client: 1 }
POST /interventions → { fk_soc: "17", description: "...", datei: "2025-04-11" }
POST /proposals     → { socid: "17", date: 1744329600, lines: [{ desc, qty, subprice, tva_tx }] }
POST /invoices      → { socid: "17", type: 0, date: 1744329600, lines: [{ desc, qty, subprice, tva_tx }] }
```

