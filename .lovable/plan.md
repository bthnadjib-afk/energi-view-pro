

# Plan : Correction de la generation PDF Fichinter (modele Soleil)

## Probleme identifie

Dans `ensureFichinterPdfReady`, le premier appel `builddoc` est suivi immediatement d'un `downloadFichinterPdfContent` sans pause. Le serveur Dolibarr n'a pas le temps de generer le fichier, d'ou le 404 systematique au premier essai.

## Corrections

### 1. `src/services/dolibarr.ts` — Refactoring de `ensureFichinterPdfReady`

Rewrite de la fonction avec la sequence stricte :
1. Appel PUT `/documents/builddoc` avec body exact : `{ modulepart: "fichinter", original_file: "{ref}/{ref}.pdf", doctemplate: "soleil", langcode: "fr_FR" }`
2. Pause de 2 secondes apres le builddoc
3. Appel GET `/documents/download?modulepart=fichinter&original_file={ref}/{ref}.pdf`
4. Si 404/erreur : relancer builddoc + pause 2s + re-download (max 2 tentatives)
5. Si toujours en echec : throw avec message "Le serveur Dolibarr tarde a generer le fichier. Reessayez dans quelques secondes."

La fonction `triggerFichinterBuilddoc` reste inchangee (deja correcte avec template `soleil`).

### 2. `src/pages/Interventions.tsx` — Bouton avec loader

- Le bouton "Generer le PDF" affiche un spinner et le texte "Generation du PDF..." pendant toute la sequence
- Le bouton reste desactive tant que le serveur n'a pas confirme (200 sur builddoc + download reussi)
- En cas d'echec apres 2 tentatives, afficher le toast d'erreur avec le message fallback

### 3. `src/hooks/useDolibarr.ts` — Hook `useGenerateInterventionPDF`

Mettre a jour le message d'erreur du hook pour utiliser le message fallback clair au lieu du generique.

## Fichiers modifies
- `src/services/dolibarr.ts` (refactor `ensureFichinterPdfReady`)
- `src/pages/Interventions.tsx` (bouton loader)
- `src/hooks/useDolibarr.ts` (message erreur)

## Ce qui ne change pas
- `triggerFichinterBuilddoc` : deja correct (template soleil, body conforme)
- `generatePDF` pour propal/facture : inchange
- Aucun nouvel endpoint invente

