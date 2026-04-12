import { cn } from '@/lib/utils';

// Status styles keyed by Dolibarr native labels (case-insensitive via lowercase match)
const statusStyles: Record<string, string> = {
  // Devis
  'brouillon': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'validé': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'validée': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'signé': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'refusé': 'bg-red-500/20 text-red-400 border-red-500/30',
  'facturé': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'facturée': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  // Factures
  'payée': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'abandonnée': 'bg-red-500/20 text-red-400 border-red-500/30',
  // Interventions
  'en cours': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'terminée': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'terminé': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'annulée': 'bg-red-500/20 text-red-400 border-red-500/30',
  'annulé': 'bg-red-500/20 text-red-400 border-red-500/30',
  // Legacy
  'en attente': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'accepté': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'impayée': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'en retard': 'bg-red-500/20 text-red-400 border-red-500/30',
  'planifié': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function StatusBadge({ statut }: { statut: string }) {
  const key = statut.toLowerCase();
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
      statusStyles[key] || 'bg-muted text-muted-foreground'
    )}>
      {statut}
    </span>
  );
}
