import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, useDevis, useInterventions, useFactures } from '@/hooks/useDolibarr';
import { UserPlus, Search, Mail, History, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatDateFR, type Client } from '@/services/dolibarr';

interface EmailRecord {
  id: string;
  document_ref: string | null;
  destinataire: string;
  objet: string;
  created_at: string;
  user_id: string;
}

interface HistoryEntry {
  date: string;
  type: 'devis' | 'intervention' | 'email' | 'facture';
  ref: string;
  label: string;
  statut?: string;
}

export default function Clients() {
  const { data: clients = [] } = useClients();
  const { data: allDevis = [] } = useDevis();
  const { data: allInterventions = [] } = useInterventions();
  const { data: allFactures = [] } = useFactures();
  const createClientMutation = useCreateClient();
  const deleteClientMutation = useDeleteClient();
  const updateClientMutation = useUpdateClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([]);

  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('');

  // P4 — Calculer projetsEnCours côté client
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

  // P3 — Recherche étendue
  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.nom.toLowerCase().includes(q) ||
      c.ville.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telephone || '').toLowerCase().includes(q) ||
      (c.codePostal || '').toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!nom.trim() || !adresse.trim() || !codePostal.trim() || !ville.trim() || !telephone.trim() || !email.trim()) {
      toast.error('Tous les champs sont obligatoires');
      return;
    }
    await createClientMutation.mutateAsync({ nom, ville, telephone, email, adresse, codePostal });
    setNom(''); setVille(''); setTelephone(''); setEmail(''); setAdresse(''); setCodePostal('');
    setDialogOpen(false);
  };

  const openDetail = (client: Client) => {
    setDetailClient(client);
    setEditMode(false);
    supabase.from('email_history').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).then(({ data }) => {
      setEmailHistory((data || []) as any);
    });
  };

  const startEdit = () => {
    if (!detailClient) return;
    setNom(detailClient.nom);
    setAdresse(detailClient.adresse || '');
    setCodePostal(detailClient.codePostal || '');
    setVille(detailClient.ville);
    setTelephone(detailClient.telephone);
    setEmail(detailClient.email);
    setEditMode(true);
  };

  const handleUpdate = async () => {
    if (!detailClient || !nom.trim()) return;
    await updateClientMutation.mutateAsync({ id: detailClient.id, nom, adresse, codePostal, ville, telephone, email });
    setEditMode(false);
    setDetailClient(null);
  };

  // P1 — Suppression async
  const handleDelete = async (id: string) => {
    await deleteClientMutation.mutateAsync(id);
  };

  // P6 — Factures dans historique
  const clientHistory: HistoryEntry[] = detailClient ? [
    ...allDevis.filter(d => d.socid === detailClient.id).map(d => ({
      date: d.date, type: 'devis' as const, ref: d.ref, label: `Devis — ${d.montantHT.toLocaleString('fr-FR')} € HT`, statut: d.statut,
    })),
    ...allInterventions.filter(i => i.socid === detailClient.id).map(i => ({
      date: i.date, type: 'intervention' as const, ref: i.ref, label: `Intervention — ${i.description}`, statut: i.statut,
    })),
    ...allFactures.filter(f => f.socid === detailClient.id).map(f => ({
      date: f.date, type: 'facture' as const, ref: f.ref, label: `Facture — ${f.montantHT.toLocaleString('fr-FR')} € HT`, statut: f.statut,
    })),
    ...emailHistory.map(e => ({
      date: e.created_at, type: 'email' as const, ref: e.document_ref || '', label: `Email — ${e.objet}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

  const typeColors: Record<string, string> = {
    devis: 'bg-blue-100 text-blue-700 border-blue-200',
    intervention: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    email: 'bg-violet-100 text-violet-700 border-violet-200',
    facture: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground text-sm">Répertoire clients</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Nom du client *" value={nom} onChange={e => setNom(e.target.value)} />
              <AddressAutocomplete value={adresse} onSelect={({ rue, codePostal: cp, ville: v }) => { setAdresse(rue); setCodePostal(cp); setVille(v); }} placeholder="Adresse (autocomplétion)" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Code postal" value={codePostal} onChange={e => setCodePostal(e.target.value)} />
                <Input placeholder="Ville" value={ville} onChange={e => setVille(e.target.value)} />
              </div>
              <Input placeholder="Téléphone" value={telephone} onChange={e => setTelephone(e.target.value)} />
              <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <Button className="w-full" onClick={handleCreate} disabled={createClientMutation.isPending || !nom.trim()}>
                {createClientMutation.isPending ? 'Création...' : 'Enregistrer'}
              </Button>
            </div>
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
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const nbProjets = projetsParClient[c.id] || 0;
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="py-3 px-2 font-medium text-foreground">{c.nom}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{c.ville}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden md:table-cell font-mono text-xs">{c.telephone}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell text-xs">{c.email}</td>
                    <td className="py-3 px-2">
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', nbProjets > 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-muted text-muted-foreground border-border')}>
                        {nbProjets} en cours
                      </span>
                    </td>
                    <td className="py-3 px-2" onClick={e => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client detail dialog */}
      <Dialog open={!!detailClient} onOpenChange={(open) => { if (!open) { setDetailClient(null); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailClient.nom}
                  {!editMode && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="info" className="pt-2">
                <TabsList>
                  <TabsTrigger value="info">Informations</TabsTrigger>
                  <TabsTrigger value="historique" className="gap-1.5"><History className="h-3.5 w-3.5" /> Historique</TabsTrigger>
                  <TabsTrigger value="emails" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Emails</TabsTrigger>
                </TabsList>
                <TabsContent value="info">
                  {editMode ? (
                    <div className="space-y-4 pt-3">
                      <Input placeholder="Nom *" value={nom} onChange={e => setNom(e.target.value)} />
                      {/* P2 — Autocomplétion en mode édition */}
                      <AddressAutocomplete value={adresse} onSelect={({ rue, codePostal: cp, ville: v }) => { setAdresse(rue); setCodePostal(cp); setVille(v); }} placeholder="Adresse (autocomplétion)" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Code postal" value={codePostal} onChange={e => setCodePostal(e.target.value)} />
                        <Input placeholder="Ville" value={ville} onChange={e => setVille(e.target.value)} />
                      </div>
                      <Input placeholder="Téléphone" value={telephone} onChange={e => setTelephone(e.target.value)} />
                      <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                      <div className="flex gap-3">
                        <Button onClick={handleUpdate} disabled={updateClientMutation.isPending}>
                          {updateClientMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                        <Button variant="outline" onClick={() => setEditMode(false)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm pt-3">
                      <div><span className="text-muted-foreground">Adresse :</span> <span className="text-foreground ml-1">{detailClient.adresse || '—'}</span></div>
                      {/* P5 — Code postal dans le détail */}
                      <div><span className="text-muted-foreground">Code postal :</span> <span className="text-foreground ml-1">{detailClient.codePostal || '—'}</span></div>
                      <div><span className="text-muted-foreground">Ville :</span> <span className="text-foreground ml-1">{detailClient.ville}</span></div>
                      <div><span className="text-muted-foreground">Téléphone :</span> <span className="text-foreground ml-1 font-mono">{detailClient.telephone}</span></div>
                      <div><span className="text-muted-foreground">Email :</span> <span className="text-foreground ml-1">{detailClient.email}</span></div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="historique">
                  <div className="pt-3">
                    {clientHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun historique pour ce client</p>
                    ) : (
                      <div className="space-y-2">
                        {clientHistory.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/50">
                            <span className="text-muted-foreground w-20 shrink-0">{formatDateFR(entry.date)}</span>
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs capitalize', typeColors[entry.type])}>{entry.type}</span>
                            <span className="text-foreground truncate flex-1">{entry.label}</span>
                            {entry.ref && <span className="font-mono text-muted-foreground">{entry.ref}</span>}
                            {entry.statut && <StatusBadge statut={entry.statut as any} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="emails">
                  <div className="pt-3">
                    {emailHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun email envoyé à ce client</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-1 text-muted-foreground">Date</th>
                            <th className="text-left py-2 px-1 text-muted-foreground">Document</th>
                            <th className="text-left py-2 px-1 text-muted-foreground">Objet</th>
                            <th className="text-left py-2 px-1 text-muted-foreground">Destinataire</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emailHistory.map(e => (
                            <tr key={e.id} className="border-b border-border/50">
                              <td className="py-2 px-1 text-muted-foreground">{formatDateFR(e.created_at)}</td>
                              <td className="py-2 px-1 font-mono text-foreground">{e.document_ref || '—'}</td>
                              <td className="py-2 px-1 text-foreground">{e.objet}</td>
                              <td className="py-2 px-1 text-muted-foreground">{e.destinataire}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
