import { cn } from '@/lib/utils';

type StatutIntervention = 'planifié' | 'en cours' | 'terminé' | 'annulé';
type StatutFacture = 'payée' | 'impayée' | 'en retard';
type StatutDevis = 'en attente' | 'accepté' | 'refusé';

type Statut = StatutIntervention | StatutFacture | StatutDevis;

const statusStyles: Record<string, string> = {
  'planifié': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'en cours': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'terminé': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'annulé': 'bg-red-500/20 text-red-400 border-red-500/30',
  'payée': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'impayée': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'en retard': 'bg-red-500/20 text-red-400 border-red-500/30',
  'en attente': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'accepté': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'refusé': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function StatusBadge({ statut }: { statut: Statut }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
      statusStyles[statut] || 'bg-muted text-muted-foreground'
    )}>
      {statut}
    </span>
  );
}
