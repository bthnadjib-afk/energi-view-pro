import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useDevis, useInterventions } from '@/hooks/useDolibarr';
import { UserPlus, Search, Trash2, Pencil, FolderOpen, Building2, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { cn, formatPhone } from '@/lib/utils';
import type { Client, TypeLogement, ClientType } from '@/services/dolibarr';

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
  clientType: ClientType;
  siret: string;
  tvaIntra: string;
  parentId: string;
}

const emptyForm: FormState = {
  nom: '', adresse: '', codePostal: '', ville: '', telephone: '', email: '',
  etage: '', codePorte: '', typeLogement: '',
  clientType: 'particulier', siret: '', tvaIntra: '', parentId: '',
};

export default function Clients() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<'all' | 'professionnel' | 'particulier'>(
    searchParams.get('type') === 'professionnel' ? 'professionnel' : 'all'
  );
  // Sync URL param changes (e.g. sidebar navigation)
  useEffect(() => {
    const t = searchParams.get('type');
    setTypeFilter(t === 'professionnel' ? 'professionnel' : t === 'particulier' ? 'particulier' : 'all');
  }, [searchParams]);

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
  const [forcedParentId, setForcedParentId] = useState<string>('');

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

  const enfantsParPro = useMemo(() => {
    const m: Record<string, number> = {};
    clients.forEach(c => {
      if (c.parentId) m[c.parentId] = (m[c.parentId] || 0) + 1;
    });
    return m;
  }, [clients]);

  const prosList = useMemo(() => clients.filter(c => c.clientType === 'professionnel'), [clients]);

  const filtered = clients.filter((c) => {
    if (typeFilter === 'professionnel' && c.clientType !== 'professionnel') return false;
    if (typeFilter === 'particulier' && c.clientType !== 'particulier') return false;
    const q = search.toLowerCase();
    return c.nom.toLowerCase().includes(q) ||
      c.ville.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telephone || '').toLowerCase().includes(q) ||
      (c.codePostal || '').toLowerCase().includes(q) ||
      (c.siret || '').toLowerCase().includes(q);
  });

  const openCreate = (parentId?: string) => {
    setForm({ ...emptyForm, parentId: parentId || '' });
    setForcedParentId(parentId || '');
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
      clientType: c.clientType || 'particulier',
      siret: c.siret || '',
      tvaIntra: c.tvaIntra || '',
      parentId: c.parentId || '',
    });
    setEditClient(c);
  };

  const handleCreate = async () => {
    if (!form.nom.trim() || !form.adresse.trim() || !form.codePostal.trim() || !form.ville.trim() || !form.telephone.trim() || !form.email.trim()) {
      toast.error('Les champs nom, adresse, code postal, ville, téléphone et email sont obligatoires');
      return;
    }
    if (form.clientType === 'professionnel' && !form.siret.trim()) {
      toast.error('Le SIRET est obligatoire pour un client professionnel');
      return;
    }
    await createClientMutation.mutateAsync(form);
    setForm(emptyForm);
    setForcedParentId('');
    setCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editClient || !form.nom.trim()) return;
    if (form.clientType === 'professionnel' && !form.siret.trim()) {
      toast.error('Le SIRET est obligatoire pour un client professionnel');
      return;
    }
    await updateClientMutation.mutateAsync({ id: editClient.id, ...form });
    setEditClient(null);
  };

  const handleDelete = async (id: string) => {
    await deleteClientMutation.mutateAsync(id);
  };

  const renderFormFields = () => (
    <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
      {/* Toggle type */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setField('clientType', 'particulier')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            form.clientType === 'particulier'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <User className="h-4 w-4" /> Particulier
        </button>
        <button
          type="button"
          onClick={() => setField('clientType', 'professionnel')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            form.clientType === 'professionnel'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <Building2 className="h-4 w-4" /> Professionnel
        </button>
      </div>

      <Input placeholder={form.clientType === 'professionnel' ? 'Raison sociale *' : 'Nom du client *'} value={form.nom} onChange={e => setField('nom', e.target.value)} />

      {/* Champs pro */}
      {form.clientType === 'professionnel' && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-border p-3 bg-muted/30">
          <Input placeholder="SIRET *" value={form.siret} onChange={e => setField('siret', e.target.value.replace(/\s/g, ''))} maxLength={14} />
          <Input placeholder="N° TVA intracom." value={form.tvaIntra} onChange={e => setField('tvaIntra', e.target.value.toUpperCase())} maxLength={20} />
        </div>
      )}

      {/* Lien à un pro parent (uniquement pour particulier) */}
      {form.clientType === 'particulier' && prosList.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Client géré par un professionnel ? (facultatif)</label>
          <Select
            value={form.parentId || 'none'}
            onValueChange={v => setField('parentId', v === 'none' ? '' : v)}
            disabled={!!forcedParentId}
          >
            <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun (client direct)</SelectItem>
              {prosList.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nom}{p.siret ? ` — ${p.siret}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
      <Input placeholder="Téléphone *" value={form.telephone} onChange={e => setField('telephone', formatPhone(e.target.value))} />
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
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setForm(emptyForm); setForcedParentId(''); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => openCreate()}>
              <UserPlus className="h-4 w-4" /> Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {forcedParentId
                  ? `Nouveau client géré par ${clients.find(c => c.id === forcedParentId)?.nom || ''}`
                  : 'Nouveau client'}
              </DialogTitle>
            </DialogHeader>
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

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (nom, ville, SIRET...)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1 gap-0.5 border border-border">
          {([['all', 'Tous'], ['professionnel', 'Pro'], ['particulier', 'Particuliers']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                typeFilter === val ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nom</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Type</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Ville</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Téléphone</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden lg:table-cell">Email</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Projets</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const nbProjets = projetsParClient[c.id] || 0;
                const nbEnfants = enfantsParPro[c.id] || 0;
                const isPro = c.clientType === 'professionnel';
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="py-3 px-2 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {isPro ? <Building2 className="h-3.5 w-3.5 text-primary shrink-0" /> : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span>{c.nom}</span>
                        {c.parentId && (
                          <span className="text-xs text-muted-foreground italic">↳ {clients.find(x => x.id === c.parentId)?.nom || 'pro'}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell">
                      {isPro ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          Pro{nbEnfants > 0 && <span className="text-muted-foreground">({nbEnfants} géré{nbEnfants > 1 ? 's' : ''})</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Particulier</span>
                      )}
                    </td>
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
                        {isPro && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Ajouter un client géré par ce pro"
                            onClick={(e) => { e.stopPropagation(); openCreate(c.id); }}
                          >
                            <Users className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
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
