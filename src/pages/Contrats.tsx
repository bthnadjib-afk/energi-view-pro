import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchContrats, createContrat, validateContrat, closeContrat, deleteContrat,
  fetchClients, type Contrat,
} from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileCheck, Search, Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDateFR } from '@/services/dolibarr';

const statutColors: Record<string, string> = {
  'Brouillon': 'bg-gray-100 text-gray-700',
  'Validé': 'bg-blue-100 text-blue-700',
  'Actif': 'bg-green-100 text-green-700',
  'Terminé': 'bg-yellow-100 text-yellow-700',
  'Fermé': 'bg-red-100 text-red-700',
};

export default function Contrats() {
  const qc = useQueryClient();
  const { data: contrats = [], isLoading } = useQuery({ queryKey: ['contrats'], queryFn: fetchContrats });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socid, setSocid] = useState('');
  const [titre, setTitre] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [note, setNote] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contrats'] });
  const resetForm = () => { setSocid(''); setTitre(''); setDateDebut(''); setDateFin(''); setNote(''); };

  const createMut = useMutation({
    mutationFn: () => createContrat({ socid, titre, dateDebut, dateFin: dateFin || undefined, note }),
    onSuccess: () => { toast.success('Contrat créé'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const validateMut = useMutation({
    mutationFn: (id: string) => validateContrat(id),
    onSuccess: () => { toast.success('Contrat validé'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => closeContrat(id),
    onSuccess: () => { toast.success('Contrat fermé'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteContrat(id),
    onSuccess: () => { toast.success('Contrat supprimé'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const filtered = contrats.filter(c =>
    c.ref.toLowerCase().includes(search.toLowerCase()) ||
    c.client.toLowerCase().includes(search.toLowerCase()) ||
    c.titre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contrats</h1>
          <p className="text-sm text-muted-foreground">{contrats.length} contrat(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nouveau contrat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Client *</label>
                <Select value={socid} onValueChange={setSocid}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Contrat de maintenance électrique" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Date début *</label>
                  <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Date fin</label>
                  <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Détails du contrat..." rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
                <Button onClick={() => createMut.mutate()} disabled={!socid || !titre || !dateDebut || createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Créer
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Titre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Début</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fin</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucun contrat</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.ref}</td>
                  <td className="px-4 py-3">{c.client}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{c.titre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateFR(c.dateDebut)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateFR(c.dateFin)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statutColors[c.statut] || 'bg-gray-100 text-gray-700'}`}>
                      {c.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {c.fk_statut === 0 && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => validateMut.mutate(c.id)} disabled={validateMut.isPending}>
                          <CheckCircle className="h-3 w-3" />Valider
                        </Button>
                      )}
                      {(c.fk_statut === 1 || c.fk_statut === 2) && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs text-muted-foreground" onClick={() => closeMut.mutate(c.id)} disabled={closeMut.isPending}>
                          <XCircle className="h-3 w-3" />Fermer
                        </Button>
                      )}
                      {c.fk_statut === 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer le contrat {c.ref} ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
