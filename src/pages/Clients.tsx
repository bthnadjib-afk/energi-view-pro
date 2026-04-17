import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useDevis, useInterventions } from '@/hooks/useDolibarr';
import { UserPlus, Search, Trash2, Pencil, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { cn } from '@/lib/utils';
import type { Client, TypeLogement } from '@/services/dolibarr';

interface FormState {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  etage: string;
  codePorte: string;
  typeLogement: TypeLogement;
}

const emptyForm: FormState = {
  nom: '', adresse: '', codePostal: '', ville: '', telephone: '', email: '',
  etage: '', codePorte: '', typeLogement: '',
};

export default function Clients() {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const { data: allDevis = [] } = useDevis();
  const { data: allInterventions = [] } = useInterventions();
  const createClientMutation = useCreateClient();
  const deleteClientMutation = useDeleteClient();
  const updateClientMutation = useUpdateClient();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const projetsParClient = useMemo(() => {
    const map: Record<string, number> = {};
    allDevis.forEach(d => {
      if (d.socid && ['brouillon', 'validé', 'signé'].includes(d.statut?.toLowerCase() || '')) {
        map[d.socid] = (map[d.socid] || 0) + 1;
      }
    });
    allInterventions.forEach(i => {
      if (i.socid && ['brouillon', 'validée', 'en cours'].includes(i.statut?.toLowerCase() || '')) {
        map[i.socid] = (map[i.socid] || 0) + 1;
      }
    });
    return map;
  }, [allDevis, allInterventions]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.nom.toLowerCase().includes(q) ||
      c.ville.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telephone || '').toLowerCase().includes(q) ||
      (c.codePostal || '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (c: Client) => {
    setForm({
      nom: c.nom,
      adresse: c.adresse || '',
      codePostal: c.codePostal || '',
      ville: c.ville,
      telephone: c.telephone,
      email: c.email,
      etage: c.etage || '',
      codePorte: c.codePorte || '',
      typeLogement: c.typeLogement || '',
    });
    setEditClient(c);
  };

  const handleCreate = async () => {
    if (!form.nom.trim() || !form.adresse.trim() || !form.codePostal.trim() || !form.ville.trim() || !form.telephone.trim() || !form.email.trim()) {
      toast.error('Les champs nom, adresse, code postal, ville, téléphone et email sont obligatoires');
      return;
    }
    await createClientMutation.mutateAsync(form);
    setForm(emptyForm);
    setCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editClient || !form.nom.trim()) return;
    await updateClientMutation.mutateAsync({ id: editClient.id, ...form });
    setEditClient(null);
  };

  const handleDelete = async (id: string) => {
    await deleteClientMutation.mutateAsync(id);
  };

  const renderFormFields = () => (
    <div className="space-y-4 pt-2">
      <Input placeholder="Nom du client *" value={form.nom} onChange={e => setField('nom', e.target.value)} />
      <AddressAutocomplete
        value={form.adresse}
        onSelect={({ rue, codePostal: cp, ville: v }) => { setField('adresse', rue); setField('codePostal', cp); setField('ville', v); }}
        placeholder="Adresse *"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Code postal *" value={form.codePostal} onChange={e => setField('codePostal', e.target.value)} />
        <Input placeholder="Ville *" value={form.ville} onChange={e => setField('ville', e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select value={form.typeLogement || 'none'} onValueChange={v => setField('typeLogement', (v === 'none' ? '' : v) as TypeLogement)}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="maison">Maison</SelectItem>
            <SelectItem value="immeuble">Immeuble</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Étage" value={form.etage} onChange={e => setField('etage', e.target.value)} />
        <Input placeholder="Code porte" value={form.codePorte} onChange={e => setField('codePorte', e.target.value)} />
      </div>
      <Input placeholder="Téléphone *" value={form.telephone} onChange={e => setField('telephone', e.target.value)} />
      <Input placeholder="Email *" type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground text-sm">Répertoire clients</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <UserPlus className="h-4 w-4" /> Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
            {renderFormFields()}
            <Button
              className="w-full mt-4"
              onClick={handleCreate}
              disabled={createClientMutation.isPending}
            >
              {createClientMutation.isPending ? 'Création...' : 'Enregistrer'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Ville</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Téléphone</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden lg:table-cell">Email</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Projets</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const nbProjets = projetsParClient[c.id] || 0;
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="py-3 px-2 font-medium text-foreground">{c.nom}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{c.ville}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden md:table-cell font-mono text-xs">{c.telephone}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell text-xs">{c.email}</td>
                    <td className="py-3 px-2">
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', nbProjets > 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-muted text-muted-foreground border-border')}>
                        {nbProjets} en cours
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Voir le dossier"
                          onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}
                        >
                          <FolderOpen className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Modifier"
                          onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                              <AlertDialogDescription>Le client "{c.nom}" sera définitivement supprimé de Dolibarr.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editClient} onOpenChange={(o) => { if (!o) setEditClient(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le client</DialogTitle></DialogHeader>
          {renderFormFields()}
          <div className="flex gap-3 mt-4">
            <Button onClick={handleUpdate} disabled={updateClientMutation.isPending} className="flex-1">
              {updateClientMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="outline" onClick={() => setEditClient(null)}>Annuler</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
