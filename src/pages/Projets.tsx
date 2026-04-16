import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchProjets, createProjet, updateProjet, deleteProjet,
  fetchClients, type Projet, PROJET_STATUTS,
} from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Search, Plus, Trash2, Pencil, Loader2, Calendar, Euro } from 'lucide-react';
import { formatDateFR } from '@/services/dolibarr';

const statutColors: Record<string, string> = {
  'Brouillon': 'bg-gray-100 text-gray-700',
  'En cours': 'bg-blue-100 text-blue-700',
  'Suspendu': 'bg-yellow-100 text-yellow-700',
  'Terminé': 'bg-green-100 text-green-700',
};

export default function Projets() {
  const qc = useQueryClient();
  const { data: projets = [], isLoading } = useQuery({ queryKey: ['projets'], queryFn: fetchProjets });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Projet | null>(null);

  const [titre, setTitre] = useState('');
  const [socid, setSocid] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [fk_statut, setFkStatut] = useState('1');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['projets'] });

  const resetForm = () => {
    setTitre(''); setSocid(''); setDateDebut(''); setDateFin('');
    setBudget(''); setDescription(''); setFkStatut('1'); setEditTarget(null);
  };

  const openEdit = (p: Projet) => {
    setEditTarget(p);
    setTitre(p.titre); setSocid(p.socid || ''); setDateDebut(p.dateDebut);
    setDateFin(p.dateFin); setBudget(String(p.budget || '')); setDescription(p.description);
    setFkStatut(String(p.fk_statut));
    setDialogOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () => createProjet({ titre, socid: socid || undefined, dateDebut, dateFin: dateFin || undefined, budget: parseFloat(budget) || 0, description }),
    onSuccess: () => { toast.success('Projet créé'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: () => updateProjet(editTarget!.id, { titre, dateFin: dateFin || undefined, budget: parseFloat(budget) || 0, description, fk_statut: parseInt(fk_statut) }),
    onSuccess: () => { toast.success('Projet modifié'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProjet(id),
    onSuccess: () => { toast.success('Projet supprimé'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const filtered = projets.filter(p =>
    p.ref.toLowerCase().includes(search.toLowerCase()) ||
    p.titre.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => editTarget ? updateMut.mutate() : createMut.mutate();
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projets</h1>
          <p className="text-sm text-muted-foreground">{projets.length} projet(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nouveau projet</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editTarget ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Installation tableau électrique" />
              </div>
              <div>
                <label className="text-sm font-medium">Client</label>
                <Select value={socid} onValueChange={setSocid}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client (optionnel)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Date début *</label>
                  <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Date fin prévue</label>
                  <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Budget HT (€)</label>
                  <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
                </div>
                {editTarget && (
                  <div>
                    <label className="text-sm font-medium">Statut</label>
                    <Select value={fk_statut} onValueChange={setFkStatut}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROJET_STATUTS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description du projet..." rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
                <Button onClick={handleSubmit} disabled={!titre || !dateDebut || isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editTarget ? 'Enregistrer' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">Aucun projet</div>
          ) : filtered.map(p => (
            <div key={p.id} className="bg-card rounded-xl border border-border p-4 space-y-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{p.titre}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.ref}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColors[p.statut] || 'bg-gray-100 text-gray-700'}`}>
                  {p.statut}
                </span>
              </div>
              {p.client && p.client !== 'Client #' && (
                <p className="text-xs text-muted-foreground">{p.client}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateFR(p.dateDebut)}
                  {p.dateFin && ` → ${formatDateFR(p.dateFin)}`}
                </div>
                {p.budget > 0 && (
                  <div className="flex items-center gap-1 font-medium text-foreground">
                    <Euro className="h-3 w-3" />{p.budget.toFixed(2)} HT
                  </div>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              )}
              <div className="flex justify-end gap-1 pt-1">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(p)}>
                  <Pencil className="h-3 w-3" />Modifier
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer le projet "{p.titre}" ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMut.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
