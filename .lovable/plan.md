

# Audit complet — Onglet Clients

## Ce qui fonctionne

| Action | API Dolibarr | Status |
|--------|-------------|--------|
| Créer client | `POST /thirdparties` | ✅ |
| Modifier client | `PUT /thirdparties/{id}` | ✅ |
| Supprimer client | `DELETE /thirdparties/{id}` | ⚠️ pas async |
| Recherche par nom/ville | Filtre local | ✅ |
| Historique devis/interventions/emails | Combiné + trié | ✅ |
| Édition inline (mode edit) | Dialog détail | ✅ |
| Autocomplétion adresse | API adresse.data.gouv.fr | ✅ |

## Problèmes identifiés

### P1 — Suppression utilise `mutate` au lieu de `mutateAsync`
Ligne 182 : `deleteClientMutation.mutate(c.id)` dans le `AlertDialogAction`. Pas séquencé — le dialog se ferme immédiatement sans attendre la confirmation Dolibarr.

**Correction** : `await deleteClientMutation.mutateAsync(c.id)`.

### P2 — Pas d'autocomplétion dans le mode édition
Le formulaire de création utilise `AddressAutocomplete` (ligne 125), mais le formulaire d'édition (lignes 219-225) utilise un simple `Input` pour l'adresse. Pas de cohérence.

**Correction** : Remplacer l'input adresse en mode édition par `AddressAutocomplete`.

### P3 — Recherche limitée (nom/ville seulement)
La recherche ne couvre ni le téléphone, ni l'email, ni le code postal.

**Correction** : Étendre le filtre pour inclure `email`, `telephone`, `codePostal`.

### P4 — `projetsEnCours` toujours à 0
Ligne 821 : `parseInt(d.nb_prospects || d.nb_projects || '0', 10)`. Ces champs Dolibarr ne contiennent probablement pas ce qu'on attend. Le compteur "en cours" devrait plutôt être calculé localement depuis les devis/interventions chargés.

**Correction** : Calculer `projetsEnCours` côté client en comptant les devis non clos + interventions non terminées pour chaque client.

### P5 — Pas de code postal affiché dans le détail
Le détail client (lignes 234-239) affiche Adresse, Ville, Téléphone, Email mais pas le Code Postal.

**Correction** : Ajouter le code postal dans l'affichage détail.

### P6 — Historique ne montre pas les factures
L'historique combine devis + interventions + emails, mais pas les factures. Or le hook `useFactures` n'est même pas importé.

**Correction** : Ajouter les factures dans l'historique client.

## Plan de correction

### `src/pages/Clients.tsx`

1. **Suppression async** : `await deleteClientMutation.mutateAsync(c.id)` dans le AlertDialogAction
2. **Autocomplétion édition** : remplacer `<Input placeholder="Adresse">` en mode edit par `<AddressAutocomplete>`
3. **Recherche étendue** : filtrer aussi par email, téléphone, code postal
4. **Projets en cours calculés** : compter les devis (fk_statut 0-2) + interventions (fk_statut 0-2) par client depuis les données déjà chargées
5. **Code postal dans détail** : ajouter une ligne CP dans la vue info
6. **Factures dans historique** : importer `useFactures`, ajouter les factures dans `clientHistory`

### `src/services/dolibarr.ts`

Aucune modification nécessaire — les types et fonctions existent déjà.

## Fichier impacté

| Fichier | Modifications |
|---------|--------------|
| `src/pages/Clients.tsx` | Async suppression, autocomplétion édition, recherche étendue, projets calculés, CP détail, factures dans historique |

## Comportement attendu de chaque action sur Dolibarr

| Action ElectroPro | Appel API | Effet Dolibarr |
|---|---|---|
| **Créer** | `POST /thirdparties` | Crée un tiers dans Dolibarr (client) |
| **Modifier** | `PUT /thirdparties/{id}` | Met à jour nom, adresse, tel, email |
| **Supprimer** | `DELETE /thirdparties/{id}` | Supprime le tiers. Échoue si des documents liés existent. |

