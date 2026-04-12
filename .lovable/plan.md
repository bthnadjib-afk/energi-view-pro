

# Audit complet — Onglet Interventions (données Dolibarr)

## Diagnostic par appel API brut

J'ai interrogé directement l'API Dolibarr (`GET /interventions`) et voici ce que retourne Dolibarr pour chaque intervention créée :

```text
dateo: ""          ← vide, pas de timestamp
datee: ""          ← vide, pas de timestamp  
datec: 1775999590  ← seul timestamp présent (date création)
array_options: []  ← tableau vide, pas d'objet
user_author_id: null
fk_statut: absent  ← le champ s'appelle "statut" ou "status"
description: null
```

## Causes racines identifiées

### P1 — `dateo`/`datee` ne sont pas sauvegardés
**Cause** : `createIntervention` envoie `datei`, `dateo`, `datee` comme timestamps Unix. Dolibarr Fichinter attend `date` (pas `datei`) pour la date principale. Les champs `dateo`/`datee` ne sont probablement pas des champs natifs de l'API REST Fichinter — Dolibarr les ignore silencieusement.
**Impact** : Date toujours vide, horaires toujours 08:00–10:00 par défaut.
**Fix** : Envoyer `date` comme timestamp Unix pour la date. Stocker les heures dans `array_options` (`options_heure_debut`, `options_heure_fin`) puisque Fichinter n'a pas de champs horaires natifs. Utiliser `datec` comme fallback pour l'affichage de date.

### P2 — `array_options` revient en `[]` au lieu d'un objet
**Cause** : Les extrafields (`options_type`, `options_technicien`, etc.) ne sont **pas configurés** dans l'instance Dolibarr. Quand aucun extrafield n'existe, Dolibarr retourne `[]` au lieu de `{}`.
**Impact** : Type toujours "chantier", technicien toujours vide.
**Fix** : Ne pas dépendre des extrafields. Stocker type/technicien/horaires dans `description` ou `note_private` en JSON sérialisé, et les parser au retour. Alternative : utiliser `duration` pour encoder les heures.

### P3 — `fk_statut` absent de la réponse API
**Cause** : Dolibarr retourne `statut` et `status` (les deux à "0"), pas `fk_statut`. Le mapping lit `d.fk_statut` qui est toujours undefined → 0 → "Brouillon".
**Impact** : Statut toujours affiché "Brouillon" même après validation.
**Fix** : Lire `d.statut || d.status` au lieu de `d.fk_statut`.

### P4 — Technicien non résolu
**Cause** : `user_author_id` est null dans la réponse. `user_creation_id` contient "1" mais n'est pas utilisé. L'assignation `fk_user_assign` n'est pas retournée par l'API GET.
**Impact** : Technicien toujours vide.
**Fix** : Utiliser `user_creation_id` comme fallback dans `resolveTechnicianName`. Sérialiser aussi le technicien dans les métadonnées stockées.

### P5 — Description null
**Cause** : `description` est transmis comme `' '` (espace) mais Dolibarr retourne `null`.
**Impact** : Mineur, mais empêche d'afficher la description.
**Fix** : Fallback sur `''`.

## Stratégie de stockage des métadonnées

Puisque les extrafields ne sont pas configurés dans Dolibarr, la solution fiable est de sérialiser les métadonnées (type, technicien, heures) dans le champ `note_private` sous forme JSON :

```text
note_private = JSON.stringify({
  type: "panne",
  technicien: "yassine",
  heureDebut: "09:00",
  heureFin: "12:00",
  notePrivee: "texte libre admin"
})
```

Au retour, on parse `note_private` pour extraire ces valeurs. Si le parse échoue (ancienne intervention sans JSON), on utilise les fallbacks actuels.

## Plan de correction

### `src/services/dolibarr.ts`

1. **`createIntervention`** : Envoyer `date` (pas `datei`/`dateo`/`datee`) comme timestamp Unix. Sérialiser type, technicien, heures dans `note_private` en JSON.

2. **`mapDolibarrIntervention`** : 
   - Lire `fk_statut` depuis `d.statut || d.status` au lieu de `d.fk_statut`
   - Parser `note_private` comme JSON pour extraire type, technicien, heures
   - Fallback sur `datec` pour la date si `dateo` est vide
   - Fallback sur `user_creation_id` pour le technicien

3. **`updateIntervention`** : Re-sérialiser les métadonnées dans `note_private` lors de l'édition.

### `src/pages/Interventions.tsx`

4. **`handleEditSave`** : Passer les métadonnées complètes (type, tech, heures) au `updateMutation` pour qu'elles soient sérialisées dans `note_private`.

### `src/pages/Agenda.tsx`

5. Aucun changement nécessaire — les corrections dans le service suffisent.

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/services/dolibarr.ts` | `createIntervention`, `updateIntervention`, `mapDolibarrIntervention` — stockage JSON dans note_private, fix fk_statut, fix date |
| `src/pages/Interventions.tsx` | `handleEditSave` — passer les métadonnées au update |

## Comportement attendu après correction

| Champ | Avant | Après |
|-------|-------|-------|
| Technicien | Toujours "—" | Nom du technicien assigné |
| Type | Toujours "Chantier" | Type choisi à la création |
| Horaire | Toujours 08:00–10:00 | Heures choisies |
| Date | Toujours "—" | Date de l'intervention |
| Statut | Toujours "Brouillon" | Statut réel Dolibarr (Validée, En cours, etc.) |

