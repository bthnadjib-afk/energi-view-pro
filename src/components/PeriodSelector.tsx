import { cn } from '@/lib/utils';

export type Period = 'journalier' | 'hebdomadaire' | 'mensuel' | 'annuel';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const periods: { value: Period; label: string }[] = [
  { value: 'journalier', label: 'Jour' },
  { value: 'hebdomadaire', label: 'Semaine' },
  { value: 'mensuel', label: 'Mois' },
  { value: 'annuel', label: 'Année' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-1 gap-0.5 border border-border">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            value === p.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
