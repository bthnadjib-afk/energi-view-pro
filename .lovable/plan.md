

# Traçabilité Intervention ↔ Devis / Facture

## Problèmes identifiés

1. **Aucun lien stocké** : `handleTransformDevis` et `handleTransformFacture` créent un devis/facture sans aucune référence à l'intervention source. Dolibarr supporte `linked_objects` dans le POST mais on ne l'utilise pas.

2. **Pas d'indicateur côté Intervention** : après avoir généré un devis ou une facture, rien ne change visuellement sur l'intervention — l'utilisateur peut cliquer plusieurs fois sans savoir qu'un document existe déjà.

3. **Pas d'indicateur côté Devis/Facture** : le devis créé depuis une intervention n'affiche aucune origine.

4. **Description vide** : la ligne créée a `subprice: 0` et `desc: inter.description` (souvent vide). Pas de référence à l'intervention dans le libellé.

## Plan de correction

### 1. `src/services/dolibarr.ts` — Ajouter `note_private` pour traçabilité

- Modifier `createDevis` pour accepter un paramètre optionnel `note_private` (string) et l'inclure dans le body POST.
- Même chose pour `createFacture`.
- Ajouter `note_private` dans l'interface `Devis` et le mapping `mapDolibarrDevis`.
- Ajouter `note_private` dans l'interface `Facture` et le mapping `mapDolibarrFacture`.

### 2. `src/pages/Interventions.tsx` — Stocker la ref intervention

- `handleTransformDevis` : passer `note_private: JSON.stringify({ from_intervention: inter.ref, intervention_id: inter.id })` lors de la création. Inclure la ref intervention dans le `desc` de la ligne (ex: `"Intervention ${inter.ref} — ${inter.description}"`).
- `handleTransformFacture` : idem.
- Après création réussie, stocker dans les métadonnées de l'intervention (via `updateIntervention` note_private) les refs des documents générés (`devis_ref` ou `facture_id`).
- Afficher un badge/indicateur dans le panneau de détail quand l'intervention a déjà un devis ou facture lié (lu depuis les données devis/factures chargées, en matchant `socid` + `note_private` contenant l'intervention ref).

### 3. `src/pages/Interventions.tsx` — Indicateur visuel dans le tableau

- Dans la liste des interventions, ajouter une colonne ou des badges (icône FileText pour devis, Receipt pour facture) quand un document lié existe.
- Cross-référencer avec les données `useDevis()` et `useFactures()` en parsant le `note_private` des devis/factures.

### 4. `src/pages/Devis.tsx` — Badge "Depuis intervention"

- Dans le tableau et le détail, si `note_private` contient `from_intervention`, afficher un badge avec la ref intervention source (ex: Badge bleu "↩ (PROV)123").

### 5. `src/pages/Factures.tsx` — Badge "Depuis intervention"

- Même logique que pour Devis.

## Fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `src/services/dolibarr.ts` | `createDevis`/`createFacture` acceptent `note_private`, interfaces Devis/Facture étendues, mappers mis à jour |
| `src/pages/Interventions.tsx` | Traçabilité dans `handleTransformDevis`/`handleTransformFacture`, badges documents liés dans tableau + détail |
| `src/pages/Devis.tsx` | Badge "Depuis intervention [ref]" |
| `src/pages/Factures.tsx` | Badge "Depuis intervention [ref]" |

## Résultat attendu

- Intervention → "Transformer en Devis" → le devis créé porte la ref intervention dans son `note_private` et dans le libellé de la ligne.
- L'intervention affiche des badges indiquant les documents générés.
- Le devis et la facture affichent un badge d'origine quand ils proviennent d'une intervention.
- L'utilisateur ne peut plus perdre la traçabilité entre intervention et documents commerciaux.

