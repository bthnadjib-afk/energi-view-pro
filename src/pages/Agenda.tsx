import { useState, useMemo } from 'react';
import { useInterventions, useClients, useCreateIntervention, useDolibarrUsers } from '@/hooks/useDolibarr';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { typesIntervention, formatDateFR, type InterventionType, resolveTechnicianName } from '@/services/dolibarr';
import type { Intervention } from '@/services/dolibarr';
import { CollisionAlert, checkCollision, type InterventionSlot } from '@/components/CollisionAlert';
import { toast } from 'sonner';
import { getInterventionStatusKey, STATUS_DOT_BG, STATUS_BADGE, STATUS_LABEL } from '@/lib/interventionStatus';

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

const TYPE_LABELS: Record<InterventionType, string> = {
  devis: 'Devis',
  panne: 'Panne',
  panne_urgence: 'Panne urgence',
  sav: 'SAV',
  chantier: 'Chantier',
};

const TYPE_COLORS: Record<InterventionType, string> = {
  devis: 'bg-blue-500',
  panne: 'bg-amber-500',
  panne_urgence: 'bg-red-500',
  sav: 'bg-violet-500',
  chantier: 'bg-emerald-500',
};


export default function Agenda() {
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const createMutation = useCreateIntervention();
  const { role } = useAuth();
  const { profile } = useAuthContext();
  const isTechnicien = role === 'technicien';
  const currentTechName = useMemo(() => {
    if (!isTechnicien || !profile) return '';
    if (profile.dolibarr_user_id) {
      const u = dolibarrUsers.find(d => String(d.id) === String(profile.dolibarr_user_id));
      if (u?.fullname) return u.fullname;
    }
    const u = dolibarrUsers.find(d => (d.email || '').toLowerCase() === (profile.email || '').toLowerCase());
    return u?.fullname || profile.nom || '';
  }, [isTechnicien, profile, dolibarrUsers]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Intervention | null>(null);

  // Day list dialog
  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState('');
  const [dayListInterventions, setDayListInterventions] = useState<Intervention[]>([]);

  // Collision
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionTech, setCollisionTech] = useState('');
  const [collisionCreneau, setCollisionCreneau] = useState('');

  // Filter
  const [filterTech, setFilterTech] = useState('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<InterventionType>('devis');
  const [newTech, setNewTech] = useState('');
  const [newHeureDebut, setNewHeureDebut] = useState('08:00');
  const [newHeureFin, setNewHeureFin] = useState('10:00');

  const technicienNames = useMemo(() => {
    const names = new Set<string>();
    dolibarrUsers.forEach(u => { if (u.fullname) names.add(u.fullname); });
    interventions.forEach(i => { if (i.technicien) names.add(i.technicien); });
    return Array.from(names).sort();
  }, [dolibarrUsers, interventions]);

  const filteredInterventions = useMemo(() => {
    // Ne jamais afficher les brouillons sur l'agenda
    let result = interventions.filter(i => i.fk_statut >= 1);
    // Technicien : ne voit QUE ses propres interventions
    if (isTechnicien && currentTechName) {
      result = result.filter(i => i.technicien === currentTechName);
    }
    if (filterTech !== 'all') {
      result = result.filter(i => i.technicien === filterTech);
    }
    return result;
  }, [interventions, filterTech, isTechnicien, currentTechName]);

  const interventionsByDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    filteredInterventions.forEach((i) => {
      const key = i.date;
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [filteredInterventions]);

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
    if (dayInterventions.length > 1) {
      setDayListDate(dateStr);
      setDayListInterventions(dayInterventions);
      setDayListOpen(true);
    } else if (dayInterventions.length === 1) {
      setSelected(dayInterventions[0]);
    } else {
      // Technicien ne peut pas créer
      if (isTechnicien) return;
      setCreateDate(dateStr);
      setNewClientId('');
      setNewDescription('');
      setNewType('devis');
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

    // Collision check
    if (newTech) {
      const slots: InterventionSlot[] = interventions.map(i => ({
        technicien: i.technicien,
        date: i.date,
        heureDebut: i.heureDebut,
        heureFin: i.heureFin,
        ref: i.ref,
      }));
      const collision = checkCollision(
        { technicien: newTech, date: createDate, heureDebut: newHeureDebut, heureFin: newHeureFin },
        slots
      );
      if (collision) {
        setCollisionTech(newTech);
        setCollisionCreneau(`${collision.ref || ''} — ${collision.heureDebut} à ${collision.heureFin}`);
        setCollisionOpen(true);
        return;
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm">
            {isTechnicien ? 'Vos interventions planifiées' : 'Cliquez sur un jour vide pour créer une intervention'}
          </p>
        </div>
        {!isTechnicien && (
          <Select value={filterTech} onValueChange={setFilterTech}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Filtrer par technicien" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les techniciens</SelectItem>
              {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={prev} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {MONTH_NAMES[month]} {year}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
              className="text-xs"
            >
              Aujourd'hui
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={next} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Type legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${TYPE_COLORS[key as InterventionType] || 'bg-muted-foreground'}`} />
              {label}
            </div>
          ))}
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
                className={`aspect-square rounded-lg p-1 flex flex-col cursor-pointer transition-colors group hover:bg-accent/30 ${isToday ? 'ring-1 ring-primary/50 bg-primary/5' : ''} ${dayInterventions.length === 0 ? 'hover:ring-1 hover:ring-primary/30' : ''}`}
                onClick={() => handleDayClick(dateStr, dayInterventions)}
              >
                <span className={`text-xs font-medium self-end px-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                  {dayInterventions.slice(0, 3).map((inter) => {
                    const statusBg = STATUS_BADGE[getInterventionStatusKey(inter)];
                    return (
                      <div
                        key={inter.id}
                        className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate border ${statusBg}`}
                        title={`${inter.ref} - ${inter.client} (${TYPE_LABELS[inter.type] || inter.type}) — ${STATUS_LABEL[getInterventionStatusKey(inter)]}`}
                        onClick={(e) => { e.stopPropagation(); setSelected(inter); }}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${TYPE_COLORS[inter.type] || 'bg-muted-foreground'}`} />
                        <span className="hidden sm:inline">{inter.client.split(' ').slice(0, 2).join(' ')}</span>
                        <span className="sm:hidden">{inter.ref.split('-').pop()}</span>
                      </div>
                    );
                  })}
                  {dayInterventions.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayInterventions.length - 3}</span>
                  )}
                  {dayInterventions.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity">
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
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="text-foreground">{TYPE_LABELS[selected.type] || selected.type}</p>
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

      {/* Day list dialog (multiple interventions on same day) */}
      <Dialog open={dayListOpen} onOpenChange={setDayListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Interventions du {formatDateFR(dayListDate)}</DialogTitle>
            <DialogDescription className="sr-only">Liste des interventions de ce jour</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2 max-h-80 overflow-y-auto">
            {dayListInterventions.map(inter => (
              <div
                key={inter.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={() => { setDayListOpen(false); setSelected(inter); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_BG[getInterventionStatusKey(inter)]}`} />
                    <span className="font-mono text-xs text-muted-foreground">{inter.ref}</span>
                    <span className="text-xs text-muted-foreground">{inter.heureDebut}–{inter.heureFin}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate mt-0.5">{inter.client}</p>
                  <p className="text-xs text-muted-foreground">{inter.technicien || '—'} · {TYPE_LABELS[inter.type] || inter.type}</p>
                </div>
                <StatusBadge statut={inter.statut} />
              </div>
            ))}
          </div>
          {!isTechnicien && (
            <Button variant="outline" className="w-full mt-2" onClick={() => {
              setDayListOpen(false);
              setCreateDate(dayListDate);
              setNewClientId('');
              setNewDescription('');
              setNewType('devis');
              setNewTech('');
              setNewHeureDebut('08:00');
              setNewHeureFin('10:00');
              setCreateOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter une intervention
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Create intervention dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle intervention — {formatDateFR(createDate)}</DialogTitle>
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
              {createMutation.isPending ? 'Création...' : "Créer l'intervention"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Collision alert */}
      <CollisionAlert
        open={collisionOpen}
        onClose={() => setCollisionOpen(false)}
        technicien={collisionTech}
        creneauExistant={collisionCreneau}
      />
    </div>
  );
}
