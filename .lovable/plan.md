

# Conformité stricte au Backend Dolibarr

## Règle enregistrée

Cette directive sera sauvegardée comme contrainte fondamentale du projet, appliquée à chaque modification future :

1. **Aucun champ UI sans équivalent API** : tout champ de formulaire doit correspondre à un champ existant dans l'API REST Dolibarr, vérifié via `src/services/dolibarr.ts` et les réponses API réelles.

2. **Validation miroir** : si un champ est `required` côté API, il l'est dans l'UI. S'il est optionnel, il l'est dans l'UI. S'il n'existe pas, il n'apparaît pas.

3. **Aucune invention** : en cas de doute sur l'existence d'un champ ou module, demander confirmation avant d'implémenter.

4. **Audit préalable** : avant toute modification d'un formulaire (Client, Devis, Facture, Intervention, Utilisateur), consulter le service dolibarr.ts et les réponses réseau pour confirmer les champs disponibles.

## Action

Sauvegarder cette règle dans `mem://constraints/dolibarr-conformity` et l'ajouter au Core de `mem://index.md` pour qu'elle s'applique systématiquement.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `mem://constraints/dolibarr-conformity` | Nouvelle mémoire avec la règle complète |
| `mem://index.md` | Ajout de la règle au Core + référence dans Memories |

