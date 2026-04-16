import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchCommandes, createCommande, validateCommande, deleteCommande,
  setCommandeToDraft, convertCommandeToFacture, fetchClients, fetchProduits,
  type Commande, COMMANDE_STATUTS,
} from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, Plus, Trash2, CheckCircle, FileText, RotateCcw, Loader2 } from 'lucide-react';
import { formatDateFR } from '@/services/dolibarr';

const statutColors: Record<string, string> = {
  'Brouillon': 'bg-gray-100 text-gray-700',
  'Validée': 'bg-blue-100 text-blue-700',
  'En cours': 'bg-yellow-100 text-yellow-700',
  'Livrée': 'bg-green-100 text-green-700',
  'Facturée': 'bg-purple-100 text-purple-700',
  'Annulée': 'bg-red-100 text-red-700',
};

export default function Commandes() {
  const qc = useQueryClient();
  const { data: commandes = [], isLoading } = useQuery({ queryKey: ['commandes'], queryFn: fetchCommandes });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });
  const { data: produits = [] } = useQuery({ queryKey: ['produits'], queryFn: fetchProduits });

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState([{ produitId: '', desc: '', qty: 1, prix: 0, tva: 20 }]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['commandes'] });

  const createMut = useMutation({
    mutationFn: () => {
      const lines = lignes.map(l => {
        const p = produits.find(p => p.id === l.produitId);
        return { desc: p ? `[${p.ref}] ${p.label}` : l.desc, qty: l.qty, subprice: l.prix, tva_tx: l.tva, product_type: p?.type === 'main_oeuvre' ? 1 : 0 };
      });
      return createCommande(socid, lines);
    },
    onSuccess: () => { toast.success('Commande créée'); setDialogOpen(false); resetForm(); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const validateMut = useMutation({
    mutationFn: (id: string) => validateCommande(id),
    onSuccess: () => { toast.success('Commande validée'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const draftMut = useMutation({
    mutationFn: (id: string) => setCommandeToDraft(id),
    onSuccess: () => { toast.success('Remis en brouillon'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const facturerMut = useMutation({
    mutationFn: (id: string) => convertCommandeToFacture(id),
    onSuccess: () => { toast.success('Facture créée depuis la commande'); invalidate(); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCommande(id),
    onSuccess: () => { toast.success('Commande supprimée'); invalidate(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const resetForm = () => {
    setSocid('');
    setLignes([{ produitId: '', desc: '', qty: 1, prix: 0, tva: 20 }]);
  };

  const addLigne = () => setLignes(prev => [...prev, { produitId: '', desc: '', qty: 1, prix: 0, tva: 20 }]);
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, field: string, value: any) => {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      if (field === 'produitId') {
        const p = produits.find(p => p.id === value);
        return { ...l, produitId: value, desc: p?.label || '', prix: p?.prixHT || 0, tva: p?.tauxTVA || 20 };
      }
      return { ...l, [field]: value };
    }));
  };

  const filtered = commandes.filter(c =>
    c.ref.toLowerCase().includes(search.toLowerCase()) ||
    c.client.toLowerCase().includes(search.toLowerCase())
  );

  const totalHT = lignes.reduce((s, l) => s + l.qty * l.prix, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commandes clients</h1>
          <p className="text-sm text-muted-foreground">{commandes.length} commande(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nouvelle commande</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Lignes</label>
                {lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Select value={l.produitId} onValueChange={v => updateLigne(i, 'produitId', v)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Produit" /></SelectTrigger>
                        <SelectContent>
                          {produits.map(p => <SelectItem key={p.id} value={p.id}>{p.ref} — {p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input placeholder="Description" value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} className="text-xs" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" placeholder="Qté" value={l.qty} onChange={e => updateLigne(i, 'qty', parseFloat(e.target.value) || 1)} className="text-xs" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Prix HT" value={l.prix} onChange={e => updateLigne(i, 'prix', parseFloat(e.target.value) || 0)} className="text-xs" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" placeholder="TVA%" value={l.tva} onChange={e => updateLigne(i, 'tva', parseFloat(e.target.value) || 0)} className="text-xs" />
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" onClick={() => removeLigne(i)} disabled={lignes.length === 1}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLigne} className="gap-1"><Plus className="h-3 w-3" />Ajouter une ligne</Button>
              </div>
              <div className="text-right font-medium">Total HT : {totalHT.toFixed(2)} €</div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
                <Button onClick={() => createMut.mutate()} disabled={!socid || createMut.isPending}>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Montant HT</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Aucune commande</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{c.ref}</td>
                  <td className="px-4 py-3">{c.client}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateFR(c.date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{c.montantHT.toFixed(2)} €</td>
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
                      {c.fk_statut === 1 && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => facturerMut.mutate(c.id)} disabled={facturerMut.isPending}>
                            <FileText className="h-3 w-3" />Facturer
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => draftMut.mutate(c.id)} disabled={draftMut.isPending}>
                            <RotateCcw className="h-3 w-3" />Brouillon
                          </Button>
                        </>
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
                              <AlertDialogTitle>Supprimer la commande {c.ref} ?</AlertDialogTitle>
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
