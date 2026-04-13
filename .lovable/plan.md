

# Correction du modulepart pour les PDF d'interventions

## Problème identifié

L'erreur `"Forbidden: Generation not available for this modulepart"` vient d'une faute de frappe dans le code : le modulepart envoyé à l'API Dolibarr est **`ficheinter`** alors que Dolibarr attend **`fichinter`** (sans le 'e').

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `src/services/dolibarr.ts` | Corriger le type `DolibarrModulepart` : remplacer `'ficheinter'` par `'fichinter'` |
| `src/pages/Interventions.tsx` | Mettre à jour les 3 appels `generatePDF` et `downloadPDFUrl` pour utiliser `'fichinter'` au lieu de `'ficheinter'` |

## Detail technique

- **Ligne 505** de `dolibarr.ts` : le type union `'ficheinter'` devient `'fichinter'`
- **Lignes 265, 267, 286** de `Interventions.tsx` : remplacer `'ficheinter'` par `'fichinter'`
- Le modèle PDF par défaut `'soleil'` reste inchangé (modèle standard Dolibarr pour fichinter)

