import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { Intervention } from '@/services/dolibarr';

interface UrgencyWidgetProps {
  interventions: Intervention[];
}

export function UrgencyWidget({ interventions }: UrgencyWidgetProps) {
  const urgences = interventions.filter(
    (i) => (i.type === 'panne' || i.type === 'sav') && (i.statut === 'validé' || i.statut === 'en cours')
  );

  if (urgences.length === 0) return null;

  return (
    <div className="glass rounded-xl p-5 border-destructive/30">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Urgences</h2>
        <span className="ml-auto bg-destructive/20 text-destructive text-xs font-bold px-2 py-0.5 rounded-full">
          {urgences.length}
        </span>
      </div>
      <div className="space-y-2">
        {urgences.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div>
              <span className="font-mono text-xs text-foreground">{u.ref}</span>
              <span className="text-muted-foreground text-xs ml-2">{u.client}</span>
            </div>
            <StatusBadge statut={u.statut} />
          </div>
        ))}
      </div>
    </div>
  );
}
