// Les lots/gabarits sont stockés dans Dolibarr (produits avec préfixe ref "LOT-")
// Ce fichier ré-exporte depuis dolibarr.ts pour garder les imports stables.
export type { GroupLine, ProductGroup, ProductGroupInput } from '@/services/dolibarr';
export {
  fetchProductGroups,
  createProductGroup,
  updateProductGroup,
  deleteProductGroup,
} from '@/services/dolibarr';
