import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  'brouillon': 'bg-gray-100 text-gray-600 border-gray-200',
  'ouvert': 'bg-blue-100 text-blue-700 border-blue-200',
  'envoyé': 'bg-blue-100 text-blue-700 border-blue-200',
  'validé': 'bg-blue-100 text-blue-700 border-blue-200',
  'validée': 'bg-blue-100 text-blue-700 border-blue-200',
  'accepté': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'signé': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'refusé': 'bg-red-100 text-red-700 border-red-200',
  'facturé': 'bg-violet-100 text-violet-700 border-violet-200',
  'facturée': 'bg-violet-100 text-violet-700 border-violet-200',
  'payée': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'partiellement payée': 'bg-orange-100 text-orange-700 border-orange-200',
  'non payée': 'bg-amber-100 text-amber-700 border-amber-200',
  'impayée': 'bg-amber-100 text-amber-700 border-amber-200',
  'abandonnée': 'bg-red-100 text-red-700 border-red-200',
  'en cours': 'bg-orange-100 text-orange-700 border-orange-200',
  'terminée': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'terminé': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'annulée': 'bg-red-100 text-red-700 border-red-200',
  'annulé': 'bg-red-100 text-red-700 border-red-200',
  'en attente': 'bg-blue-100 text-blue-700 border-blue-200',
  'en retard': 'bg-red-100 text-red-700 border-red-200',
  'planifié': 'bg-blue-100 text-blue-700 border-blue-200',
  'envoyée': 'bg-blue-100 text-blue-700 border-blue-200',
  'relance devis': 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
  'relancé': 'bg-sky-100 text-sky-700 border-sky-300',
  'relancée': 'bg-orange-200 text-orange-900 border-orange-300 font-semibold',
  'relance': 'bg-orange-100 text-orange-700 border-orange-200',
  'mise en demeure': 'bg-red-200 text-red-900 border-red-300 font-semibold',
  'non payée — relance': 'bg-orange-200 text-orange-900 border-orange-300',
  'non payée — mise en demeure': 'bg-red-200 text-red-900 border-red-300',
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
