import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Intervention } from '@/services/dolibarr';
import { getInterventionStatusKey, STATUS_DOT_BG, STATUS_LABEL } from '@/lib/interventionStatus';

interface Props {
  /** Toutes les interventions du tech sélectionné (pour afficher les pastilles) */
  techInterventions: Intervention[];
  /** Date min sélectionnable au format YYYY-MM-DD */
  minDate?: string;
  /** Dates déjà choisies à griser/marquer */
  excludedDates?: string[];
  /** Callback quand l'utilisateur valide une date */
  onPick: (date: string) => void;
  /** Texte du bouton trigger */
  label?: string;
  className?: string;
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_NAMES = ['L','M','M','J','V','S','D'];

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function DatePickerWithStatus({ techInterventions, minDate, excludedDates = [], onPick, label = 'Choisir une date', className }: Props) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const interByDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    techInterventions.forEach(i => {
      if (!i.date) return;
      (map[i.date] = map[i.date] || []).push(i);
    });
    return map;
  }, [techInterventions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayJs = new Date(year, month, 1).getDay();
  const firstDay = firstDayJs === 0 ? 6 : firstDayJs - 1;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const minDateObj = minDate ? new Date(`${minDate}T00:00:00`) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn('justify-start gap-2 font-normal w-full', className)}>
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">{MONTH_NAMES[month]} {year}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d, i) => <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="h-9 w-9" />;
            const iso = toIso(new Date(year, month, day));
            const dayInter = interByDate[iso] || [];
            const dayDate = new Date(year, month, day);
            const disabled = (minDateObj && dayDate < minDateObj) || excludedDates.includes(iso);
            const isToday = iso === toIso(today);
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => { onPick(iso); setOpen(false); }}
                title={dayInter.length ? dayInter.map(i => `${i.ref} (${STATUS_LABEL[getInterventionStatusKey(i)]})`).join('\n') : ''}
                className={cn(
                  'h-9 w-9 rounded-md text-xs font-medium relative flex items-center justify-center transition-colors',
                  disabled ? 'text-muted-foreground/40 cursor-not-allowed' : 'hover:bg-accent text-foreground',
                  isToday && !disabled && 'ring-1 ring-primary',
                )}
              >
                {day}
                {dayInter.length > 0 && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayInter.slice(0, 3).map((i, k) => (
                      <span key={k} className={cn('inline-block w-1 h-1 rounded-full', STATUS_DOT_BG[getInterventionStatusKey(i)])} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Validée</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />En cours</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Terminée</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Annulée</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
