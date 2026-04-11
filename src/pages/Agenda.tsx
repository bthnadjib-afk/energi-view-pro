import { useState, useMemo } from 'react';
import { useInterventions } from '@/hooks/useDolibarr';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Intervention } from '@/services/dolibarr';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday-based
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const statusColor: Record<string, string> = {
  'planifié': 'bg-blue-500',
  'en cours': 'bg-amber-500',
  'terminé': 'bg-emerald-500',
  'annulé': 'bg-red-500',
};

export default function Agenda() {
  const { data: interventions = [] } = useInterventions();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Intervention | null>(null);

  const interventionsByDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    interventions.forEach((i) => {
      const key = i.date;
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [interventions]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <p className="text-muted-foreground text-sm">Planning des interventions</p>
      </div>

      <div className="glass rounded-xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={prev} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" onClick={next} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="aspect-square" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayInterventions = interventionsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={idx}
                className={`aspect-square rounded-lg p-1 flex flex-col cursor-pointer transition-colors hover:bg-accent/30 ${isToday ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}
                onClick={() => dayInterventions.length > 0 && setSelected(dayInterventions[0])}
              >
                <span className={`text-xs font-medium self-end px-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                  {dayInterventions.slice(0, 3).map((inter) => (
                    <div
                      key={inter.id}
                      className={`rounded px-1 py-0.5 text-[10px] leading-tight text-foreground truncate ${statusColor[inter.statut]}/20`}
                      title={`${inter.ref} - ${inter.client}`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusColor[inter.statut]}`} />
                      <span className="hidden sm:inline">{inter.client.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="sm:hidden">{inter.ref.split('-').pop()}</span>
                    </div>
                  ))}
                  {dayInterventions.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayInterventions.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="glass rounded-xl p-5 relative animate-in slide-in-from-bottom-2">
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground" onClick={() => setSelected(null)}>
            <X className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-foreground mb-3">Détail intervention</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Référence</p>
              <p className="font-mono text-foreground">{selected.ref}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Client</p>
              <p className="text-foreground">{selected.client}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Technicien</p>
              <p className="text-foreground">{selected.technicien}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Date</p>
              <p className="text-foreground">{new Date(selected.date).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Statut</p>
              <StatusBadge statut={selected.statut} />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Description</p>
              <p className="text-foreground">{selected.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
