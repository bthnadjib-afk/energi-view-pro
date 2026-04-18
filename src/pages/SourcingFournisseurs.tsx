import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createProduit } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Globe, Plus, RefreshCw, Eye, Trash2, Loader2, CheckCircle2, XCircle,
  Download, ExternalLink, Package, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Frequence = 'manuel' | 'quotidien' | 'hebdomadaire' | 'mensuel';

interface SourcingSupplier {
  id: string;
  nom: string;
  url: string;
  frequence: Frequence;
  actif: boolean;
  derniere_execution: string | null;
  dernier_statut: 'success' | 'error' | 'running' | null;
  dernier_message: string | null;
  nb_articles_detectes: number;
}

interface SourcingItem {
  id: string;
  supplier_id: string;
  ref_externe: string | null;
  designation: string;
  description: string | null;
  prix_fournisseur: number | null;
  devise: string | null;
  url_produit: string | null;
  url_image: string | null;
  stock_dispo: string | null;
  importe: boolean;
  importe_at: string | null;
  importe_product_id: string | null;
  scan_batch_id: string | null;
  created_at: string;
}

const FREQ_LABEL: Record<Frequence, string> = {
  manuel: 'Manuel',
  quotidien: 'Quotidien',
  hebdomadaire: 'Hebdomadaire',
  mensuel: 'Mensuel',
};

export default function SourcingFournisseurs() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SourcingSupplier | null>(null);
  const [viewItemsTarget, setViewItemsTarget] = useState<SourcingSupplier | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Form state
  const [formNom, setFormNom] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formFreq, setFormFreq] = useState<Frequence>('manuel');

  // ── Fetch suppliers ────────────────────────────────────────────────────────
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['sourcing-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_suppliers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SourcingSupplier[];
    },
  });

  // ── Create / update supplier ───────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: async (payload: { id?: string; nom: string; url: string; frequence: Frequence }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('sourcing_suppliers')
          .update({ nom: payload.nom, url: payload.url, frequence: payload.frequence })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');
        const { error } = await supabase
          .from('sourcing_suppliers')
          .insert({ nom: payload.nom, url: payload.url, frequence: payload.frequence, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sourcing-suppliers'] });
      setCreateOpen(false);
      setEditTarget(null);
      resetForm();
      toast.success('Fournisseur enregistré');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sourcing_suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sourcing-suppliers'] });
      toast.success('Fournisseur supprimé');
    },
    onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
  });

  const resetForm = () => {
    setFormNom('');
    setFormUrl('');
    setFormFreq('manuel');
  };

  const openCreate = () => {
    resetForm();
    setEditTarget(null);
    setCreateOpen(true);
  };

  const openEdit = (s: SourcingSupplier) => {
    setEditTarget(s);
    setFormNom(s.nom);
    setFormUrl(s.url);
    setFormFreq(s.frequence);
    setCreateOpen(true);
  };

  const handleSave = () => {
    if (!formNom.trim() || !formUrl.trim()) {
      toast.error('Nom et URL sont requis');
      return;
    }
    try {
      new URL(formUrl);
    } catch {
      toast.error('URL invalide');
      return;
    }
    upsertMutation.mutate({
      id: editTarget?.id,
      nom: formNom.trim(),
      url: formUrl.trim(),
      frequence: formFreq,
    });
  };

  // ── Lancer scan ────────────────────────────────────────────────────────────
  const handleScan = async (s: SourcingSupplier) => {
    setScanningId(s.id);
    try {
      const { data, error } = await supabase.functions.invoke('scan-supplier', {
        body: { supplier_id: s.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Scan terminé : ${data.count} article(s) détecté(s)`);
      qc.invalidateQueries({ queryKey: ['sourcing-suppliers'] });
      qc.invalidateQueries({ queryKey: ['sourcing-items', s.id] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Échec scan : ${msg}`);
      qc.invalidateQueries({ queryKey: ['sourcing-suppliers'] });
    } finally {
      setScanningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> Sourcing Fournisseurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Surveille automatiquement les catalogues de tes fournisseurs et importe les articles en un clic.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter un fournisseur
        </Button>
      </div>

      {/* Liste fournisseurs */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground font-medium">Aucun fournisseur configuré</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ajoute tes fournisseurs principaux pour suivre leur catalogue et leurs prix automatiquement.
            </p>
            <Button onClick={openCreate} className="gap-2 mt-2">
              <Plus className="h-4 w-4" /> Ajouter mon premier fournisseur
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Dernier scan</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => {
                const isScanning = scanningId === s.id || s.dernier_statut === 'running';
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-foreground">{s.nom}</TableCell>
                    <TableCell>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        {s.url.replace(/^https?:\/\//, '').slice(0, 40)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                        {FREQ_LABEL[s.frequence]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.derniere_execution ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          {s.dernier_statut === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          {s.dernier_statut === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                          {s.dernier_statut === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                          <span className="text-muted-foreground">
                            {new Date(s.derniere_execution).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Jamais</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">{s.nb_articles_detectes}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScan(s)}
                          disabled={isScanning}
                          className="gap-1.5"
                        >
                          {isScanning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Lancer le scan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewItemsTarget(s)}
                          className="gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" /> Articles
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer "{s.nom}" ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action supprimera également tous les articles scannés associés.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(s.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog créer/éditer */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Modifier le fournisseur' : 'Nouveau fournisseur à scanner'}</DialogTitle>
            <DialogDescription>
              Renseigne le nom commercial et l'URL du catalogue à surveiller.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Nom *</label>
              <Input
                placeholder="ex : Rexel, Sonepar, CGED..."
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">URL du catalogue *</label>
              <Input
                placeholder="https://www.fournisseur.fr/catalogue"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Fréquence de scan</label>
              <Select value={formFreq} onValueChange={(v) => setFormFreq(v as Frequence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manuel">Manuel uniquement</SelectItem>
                  <SelectItem value="quotidien">Quotidien</SelectItem>
                  <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Les scans automatiques nécessitent un job planifié côté serveur (à configurer ultérieurement).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editTarget ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet — Articles détectés */}
      <Sheet open={!!viewItemsTarget} onOpenChange={(o) => !o && setViewItemsTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          {viewItemsTarget && <ArticlesPanel supplier={viewItemsTarget} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Panneau articles détectés
// ──────────────────────────────────────────────────────────────────────────────
function ArticlesPanel({ supplier }: { supplier: SourcingSupplier }) {
  const qc = useQueryClient();
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sourcing-items', supplier.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_items')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SourcingItem[];
    },
  });

  const handleImport = async (item: SourcingItem) => {
    setImportingId(item.id);
    try {
      const ref = item.ref_externe || `IMP-${Date.now().toString(36).toUpperCase()}`;
      const productId = await createProduit({
        ref,
        label: item.designation,
        description: item.description || undefined,
        price: item.prix_fournisseur || 0,
        tva_tx: 20,
        type: 0, // fourniture
        cost_price: item.prix_fournisseur || 0,
      });
      const { error } = await supabase
        .from('sourcing_items')
        .update({
          importe: true,
          importe_at: new Date().toISOString(),
          importe_product_id: productId,
        })
        .eq('id', item.id);
      if (error) throw error;
      toast.success(`Article importé dans le catalogue (#${productId})`);
      qc.invalidateQueries({ queryKey: ['sourcing-items', supplier.id] });
      qc.invalidateQueries({ queryKey: ['produits'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Import échoué : ${msg}`);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Articles détectés — {supplier.nom}
        </SheetTitle>
        <SheetDescription>
          Sélectionne les articles à importer dans ton catalogue Dolibarr.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Aucun article détecté pour l'instant</p>
            <p className="text-xs text-muted-foreground">Lance un scan depuis la liste pour récupérer les articles.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Photo</TableHead>
                <TableHead>Réf</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id} className={cn(it.importe && 'opacity-60')}>
                  <TableCell>
                    {it.url_image ? (
                      <img
                        src={it.url_image}
                        alt={it.designation}
                        className="w-14 h-14 object-cover rounded border border-border bg-muted"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded border border-border bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {it.ref_externe || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{it.designation}</p>
                      {it.url_produit && (
                        <a
                          href={it.url_produit}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          Voir source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {it.stock_dispo && (
                        <p className="text-xs text-muted-foreground">{it.stock_dispo}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {it.prix_fournisseur != null
                      ? `${it.prix_fournisseur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${it.devise || '€'}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {it.importe ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Importé
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleImport(it)}
                        disabled={importingId === it.id}
                        className="gap-1.5"
                      >
                        {importingId === it.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Importer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
