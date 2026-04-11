

## Plan — Phase finale : Statuts devis, Emails types, Signature devis, Synchro utilisateurs, Fix intervention

### Vue d'ensemble

Ce plan integre les demandes precedentes (statuts, emails, synchro users, fix intervention, edition devis) PLUS les 3 precisions ajoutees :
- Variables dans les modeles d'emails (`[NOM_CLIENT]`, `[REF_DEVIS]`, etc.)
- Signature client sur le devis avant passage a "Accepte"
- `user_id` (expediteur) dans la table `email_history`

---

### 1. Migration SQL — Tables `email_templates` et `email_history`

```sql
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  objet text NOT NULL DEFAULT '',
  corps text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),  -- QUI a envoye
  client_id text NOT NULL,
  document_ref text,
  destinataire text NOT NULL,
  objet text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view email history" ON public.email_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert email history" ON public.email_history
  FOR INSERT TO authenticated WITH CHECK (true);
```

Modeles pre-inseres via insert :
- "Relance devis" — Objet : `Relance devis [REF_DEVIS]`, Corps avec `[NOM_CLIENT]`, `[REF_DEVIS]`, `[MONTANT_TTC]`
- "Facture a payer" — Objet : `Facture [REF_FACTURE] a regler`, Corps avec `[NOM_CLIENT]`, `[REF_FACTURE]`, `[MONTANT_TTC]`
- "Fin de chantier" — Objet : `Intervention terminee`, Corps avec `[NOM_CLIENT]`, `[REF_INTERVENTION]`

---

### 2. `src/services/dolibarr.ts` — Nouveaux endpoints

| Fonction | Endpoint | But |
|---|---|---|
| `updateDevis(id, socid, lines)` | PUT `/proposals/{id}` | Modifier un devis |
| `validateDevis(id)` | POST `/proposals/{id}/validate` | Brouillon → Valide |
| `closeDevis(id, status)` | POST `/proposals/{id}/close` | Accepter (2) / Refuser (3) |
| `createDolibarrUser(data)` | POST `/users` | Synchro utilisateur |

Fix `createIntervention` : envoyer `fk_soc` EN PLUS de `socid`, et `dateo` en plus de `datei` pour compatibilite toutes versions Dolibarr.

---

### 3. `src/hooks/useDolibarr.ts` — Nouvelles mutations

- `useUpdateDevis()` — invalidate `['devis']`
- `useValidateDevis()` — invalidate `['devis']`
- `useCloseDevis()` — invalidate `['devis']`

---

### 4. `src/pages/Devis.tsx` — Statuts + Signature client + Email

**Boutons de statut dans DevisDetail** (conditionnels selon statut courant) :
- Brouillon/En attente → "Valider" (passe a valide)
- Valide → "Accepter (Signe)" / "Refuser"
- Accepte → "Convertir en Facture" / "Saisir acompte" (deja present)

**Signature client** : Quand on clique "Accepter (Signe)", un `SignaturePad` s'affiche dans le dialog. Le client signe, puis le statut passe a accepte. La signature est stockee localement sur l'objet devis.

**Bouton "Envoyer par email"** : Ouvre un dialog avec :
- Destinataire (pre-rempli depuis client email)
- Select de modele d'email (charge depuis `email_templates`)
- Objet et Message (pre-remplis depuis le modele, variables remplacees)
- Variables supportees : `[NOM_CLIENT]`, `[REF_DEVIS]`, `[MONTANT_TTC]`, `[NOM_ENTREPRISE]`
- Bouton "Envoyer" → log dans `email_history` avec `user_id` de l'utilisateur connecte

---

### 5. `src/pages/Configuration.tsx` — Onglet "Modeles emails"

Nouvel onglet avec :
- Liste des modeles existants (nom, objet, apercu du corps)
- Bouton "Ajouter un modele"
- Edition inline du nom, objet, corps
- Aide contextuelle : "Variables disponibles : `[NOM_CLIENT]`, `[REF_DEVIS]`, `[REF_FACTURE]`, `[REF_INTERVENTION]`, `[MONTANT_TTC]`, `[NOM_ENTREPRISE]`"
- CRUD via Supabase direct (table `email_templates`)

---

### 6. `src/pages/Clients.tsx` — Detail client + Historique emails

- Rendre les lignes cliquables → ouvrir un Dialog detail client
- Dans ce dialog, onglet "Emails envoyes" qui query `email_history` filtre par `client_id`
- Afficher : date, document ref, objet, expediteur (jointure profiles pour le nom via `user_id`)

---

### 7. `src/pages/Interventions.tsx` — Fix erreur creation

Modifier `createIntervention` dans `dolibarr.ts` pour envoyer :
```json
{
  "socid": 17,
  "fk_soc": 17,
  "description": "...",
  "datei": 1744329600,
  "dateo": 1744329600
}
```
Les deux champs de date et les deux champs client pour compatibilite.

---

### 8. `src/pages/Utilisateurs.tsx` — Synchro Dolibarr

Apres creation reussie dans Supabase, appeler `createDolibarrUser()` avec `{ login, firstname, lastname, email }`. Si l'appel echoue, afficher un warning (l'utilisateur local est cree quand meme).

---

### 9. Helpers — Remplacement variables emails

Fonction utilitaire `replaceEmailVariables(text, context)` :
```typescript
function replaceEmailVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([A-Z_]+)\]/g, (match, key) => vars[key] || match);
}
```
Utilisee dans le dialog d'envoi email pour pre-remplir le message.

---

### Fichiers impactes

| Fichier | Action |
|---|---|
| Migration SQL | Tables `email_templates` + `email_history` (avec `user_id`) |
| `src/services/dolibarr.ts` | +`updateDevis`, +`validateDevis`, +`closeDevis`, +`createDolibarrUser`, fix `createIntervention` |
| `src/hooks/useDolibarr.ts` | +3 mutations devis (update, validate, close) |
| `src/pages/Devis.tsx` | Boutons statut, SignaturePad avant acceptation, dialog email avec variables |
| `src/pages/Configuration.tsx` | Onglet "Modeles emails" CRUD |
| `src/pages/Clients.tsx` | Detail client cliquable + historique emails |
| `src/pages/Interventions.tsx` | Fix payload creation (double champs) |
| `src/pages/Utilisateurs.tsx` | Appel POST /users Dolibarr apres creation |

### Points cles

- Variables emails : `[NOM_CLIENT]`, `[REF_DEVIS]`, `[REF_FACTURE]`, `[REF_INTERVENTION]`, `[MONTANT_TTC]`, `[NOM_ENTREPRISE]`
- Signature devis : `SignaturePad` integre dans le flow "Accepter" avant changement de statut
- `email_history.user_id` : stocke l'ID de l'utilisateur connecte qui envoie l'email
- Aucune modification de `app_config` — la table existante reste intacte

