// Code couleur unifié des interventions
// validé = bleu | en cours = orange | terminé = vert | annulé = rouge | brouillon = gris
import type { Intervention } from '@/services/dolibarr';

export type InterStatusKey = 'brouillon' | 'validee' | 'en_cours' | 'terminee' | 'annulee';

export function getInterventionStatusKey(i: Pick<Intervention, 'fk_statut' | 'descriptionClient'>): InterStatusKey {
  // Tag app_status:annule prioritaire (stocké dans note_public/descriptionClient en JSON)
  if (i.descriptionClient) {
    try {
      const meta = JSON.parse(i.descriptionClient);
      if (meta.appStatus === 'annule') return 'annulee';
      if (meta.appStatus === 'en_cours' && i.fk_statut === 1) return 'en_cours';
    } catch { /* not JSON */ }
  }
  if (i.fk_statut >= 3) return 'terminee';
  if (i.fk_statut === 2) return 'en_cours';
  if (i.fk_statut === 1) return 'validee';
  return 'brouillon';
}

export const STATUS_LABEL: Record<InterStatusKey, string> = {
  brouillon: 'Brouillon',
  validee: 'Validée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

// Fond plein (pastille calendrier, point)
export const STATUS_DOT_BG: Record<InterStatusKey, string> = {
  brouillon: 'bg-muted-foreground',
  validee: 'bg-blue-500',
  en_cours: 'bg-orange-500',
  terminee: 'bg-emerald-500',
  annulee: 'bg-red-500',
};

// Badge / carte (bg + text + border)
export const STATUS_BADGE: Record<InterStatusKey, string> = {
  brouillon: 'bg-muted text-muted-foreground border-border',
  validee: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  en_cours: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
  terminee: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  annulee: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
};

export function getInterventionStatusLabel(i: Pick<Intervention, 'fk_statut' | 'descriptionClient' | 'statut'>): string {
  return STATUS_LABEL[getInterventionStatusKey(i)] || i.statut;
}
