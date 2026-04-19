import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur,
  type Fournisseur,
} from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { formatPhone } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Truck, Search, Plus, Trash2, Pencil, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

export default function Fournisseurs() {
  const qc = useQueryClient();
  const { data: fournisseurs = [], isLoading } = useQuery({ queryKey: ['fournisseurs'], queryFn: fetchFournisseurs });

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fournisseur | null>(null);

  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fournisseurs'] });

  const resetForm = () => { setNom(''); setAdresse(''); setCodePostal(''); setVille(''); setTelephone(''); setEmail(''); setEditTarget(null); };

  const openEdit = (f: Fournisseur) => {
    setEditTarget(f);
    setNom(f.nom); setAdresse(f.adresse || ''); setCodePostal(f.codePostal || '');
    setVille(f.ville); setTelephone(f.telephone); setEmail(f.email);
    setDialogOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () => createFournisseur({ nom, adresse, codePostal, ville, telephone, email }),
    onSuccess: () => { toast.success('Fournisseur créé'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: () => updateFournisseur(editTarget!.id, { nom, adresse, codePostal, ville, telephone, email }),
    onSuccess: () => { toast.success('Fournisseur modifié'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFournisseur(id),
    onSuccess: () => { toast.success('Fournisseur supprimé'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const filtered = fournisseurs.filter(f =>
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    f.ville.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => editTarget ? updateMut.mutate() : createMut.mutate();
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground">{fournisseurs.length} fournisseur(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nouveau fournisseur</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTarget ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nom *</label>
                <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de l'entreprise" />
              </div>
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <AddressAutocomplete
                  value={adresse}
                  onSelect={a => { setAdresse(a.rue); setCodePostal(a.codePostal); setVille(a.ville); }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Code postal</label>
                  <Input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="74000" />
                </div>
                <div>
                  <label className="text-sm font-medium">Ville</label>
                  <Input value={ville} onChange={e => setVille(e.target.value)} placeholder="Annecy" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input value={telephone} onChange={e => setTelephone(formatPhone(e.target.value))} placeholder="04 50 XX XX XX" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="contact@fournisseur.fr" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
                <Button onClick={handleSubmit} disabled={!nom || isPending}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">Aucun fournisseur</div>
          ) : filtered.map(f => (
            <div key={f.id} className="bg-card rounded-xl border border-border p-4 space-y-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{f.nom}</p>
                    {f.ville && <p className="text-xs text-muted-foreground">{f.codePostal} {f.ville}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer {f.nom} ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMut.mutate(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="space-y-1">
                {f.adresse && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />{f.adresse}
                  </div>
                )}
                {f.telephone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />{f.telephone}
                  </div>
                )}
                {f.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />{f.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
