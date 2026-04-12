

# Devis + Facture depuis toute intervention

## Situation actuelle
- **Devis** : bouton visible uniquement si `fk_statut ≤ 2` (brouillon, validée, en cours)
- **Facture** : bouton visible uniquement si `fk_statut === 3` (terminée)
- Résultat : on ne peut jamais avoir les deux options en même temps

## Correction

### `src/pages/Interventions.tsx`

**Dans le panneau de détail (lignes ~582-592)** :
- Rendre les deux boutons visibles pour tout statut ≥ 1 (validée et au-delà)
- Le bouton "Devis" reste aussi disponible en brouillon (statut 0)
- Le bouton "Facture" devient disponible dès statut 1 (pas seulement 3)

**Dans le tableau (lignes ~433-445)** :
- Même logique : afficher les icônes devis et facture pour toute intervention validée

Règles proposées :
| Statut | Devis | Facture |
|--------|-------|---------|
| 0 (Brouillon) | ✅ | ❌ |
| 1 (Validée) | ✅ | ✅ |
| 2 (En cours) | ✅ | ✅ |
| 3 (Terminée) | ✅ | ✅ |

## Fichier impacté
`src/pages/Interventions.tsx` — modifier les conditions d'affichage des boutons devis/facture dans le tableau et le panneau de détail.

