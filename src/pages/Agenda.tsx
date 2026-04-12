import { useState, useMemo } from 'react';
import { useInterventions, useClients, useCreateIntervention, useDolibarrUsers } from '@/hooks/useDolibarr';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { typesIntervention, formatDateFR, type InterventionType } from '@/services/dolibarr';
import type { Intervention } from '@/services/dolibarr';
import { toast } from 'sonner';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const statusColor: Record<string, string> = {
  'Brouillon': 'bg-muted-foreground',
  'Validée': 'bg-blue-500',
  'En cours': 'bg-amber-500',
  'Terminée': 'bg-emerald-500',
  'Annulée': 'bg-red-500',
};

export default function Agenda() {
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const createMutation = useCreateIntervention();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Intervention | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<InterventionType>('chantier');
  const [newTech, setNewTech] = useState('');
  const [newHeureDebut, setNewHeureDebut] = useState('08:00');
  const [newHeureFin, setNewHeureFin] = useState('10:00');

  const technicienNames = dolibarrUsers.map(u => u.fullname).filter(Boolean);

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

  const handleDayClick = (dateStr: string, dayInterventions: Intervention[]) => {
    if (dayInterventions.length > 0) {
      setSelected(dayInterventions[0]);
    } else {
      // Open create dialog pre-filled with date
      setCreateDate(dateStr);
      setNewClientId('');
      setNewDescription('');
      setNewType('chantier');
      setNewTech('');
      setNewHeureDebut('08:00');
      setNewHeureFin('10:00');
      setCreateOpen(true);
    }
  };

  const handleCreate = async () => {
    if (!newClientId || !createDate) {
      toast.error('Client et date requis');
      return;
    }
    const selectedUser = dolibarrUsers.find(u => u.fullname === newTech);
    await createMutation.mutateAsync({
      socid: newClientId,
      description: newDescription || ' ',
      date: createDate,
      heureDebut: newHeureDebut,
      heureFin: newHeureFin,
      fk_user_assign: selectedUser?.id,
      type: newType,
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm">Cliquez sur un jour vide pour créer une intervention</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
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
                className={`aspect-square rounded-lg p-1 flex flex-col cursor-pointer transition-colors hover:bg-accent/30 ${isToday ? 'ring-1 ring-primary/50 bg-primary/5' : ''} ${dayInterventions.length === 0 ? 'hover:ring-1 hover:ring-primary/30' : ''}`}
                onClick={() => handleDayClick(dateStr, dayInterventions)}
              >
                <span className={`text-xs font-medium self-end px-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                  {dayInterventions.slice(0, 3).map((inter) => (
                    <div
                      key={inter.id}
                      className="rounded px-1 py-0.5 text-[10px] leading-tight text-foreground truncate bg-muted/50"
                      title={`${inter.ref} - ${inter.client}`}
                      onClick={(e) => { e.stopPropagation(); setSelected(inter); }}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusColor[inter.statut] || 'bg-muted-foreground'}`} />
                      <span className="hidden sm:inline">{inter.client.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="sm:hidden">{inter.ref.split('-').pop()}</span>
                    </div>
                  ))}
                  {dayInterventions.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayInterventions.length - 3}</span>
                  )}
                  {dayInterventions.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-card rounded-xl border border-border p-5 relative animate-in slide-in-from-bottom-2 shadow-sm">
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
              <p className="text-foreground">{selected.technicien || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Date</p>
              <p className="text-foreground">{formatDateFR(selected.date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Horaire</p>
              <p className="text-foreground">{selected.heureDebut} – {selected.heureFin}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Statut</p>
              <StatusBadge statut={selected.statut} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs">Description</p>
              <p className="text-foreground">{selected.description || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create intervention dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle intervention — {createDate}</DialogTitle>
            <DialogDescription className="sr-only">Créer une intervention pour cette date</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newType} onValueChange={(v) => setNewType(v as InterventionType)}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newTech} onValueChange={setNewTech}>
              <SelectTrigger><SelectValue placeholder="Technicien" /></SelectTrigger>
              <SelectContent>
                {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Début</label>
                <Input type="time" value={newHeureDebut} onChange={(e) => setNewHeureDebut(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fin</label>
                <Input type="time" value={newHeureFin} onChange={(e) => setNewHeureFin(e.target.value)} />
              </div>
            </div>
            <Input placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? 'Création...' : 'Créer l\'intervention'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
