import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchEntrepots, fetchStockProduits, addStockMovement, type Entrepot, type StockProduit } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Warehouse, Search, AlertTriangle, Package, Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Stock() {
  const qc = useQueryClient();
  const { data: entrepots = [], isLoading: loadingEntrepots } = useQuery({ queryKey: ['entrepots'], queryFn: fetchEntrepots });
  const [selectedEntrepot, setSelectedEntrepot] = useState<string>('');
  const [search, setSearch] = useState('');
  const [mvtDialog, setMvtDialog] = useState<StockProduit | null>(null);
  const [mvtQty, setMvtQty] = useState('');
  const [mvtLabel, setMvtLabel] = useState('');
  const [mvtSens, setMvtSens] = useState<'plus' | 'moins'>('plus');

  const { data: produits = [], isLoading: loadingProduits } = useQuery({
    queryKey: ['stock-produits', selectedEntrepot],
    queryFn: () => fetchStockProduits(selectedEntrepot || undefined),
    enabled: true,
  });

  const mvtMut = useMutation({
    mutationFn: () => {
      if (!mvtDialog || !selectedEntrepot) throw new Error('Sélectionnez un entrepôt');
      const qty = mvtSens === 'plus' ? Math.abs(parseFloat(mvtQty)) : -Math.abs(parseFloat(mvtQty));
      return addStockMovement(mvtDialog.id, selectedEntrepot, qty, mvtLabel || 'Mouvement manuel');
    },
    onSuccess: () => {
      toast.success('Mouvement de stock enregistré');
      setMvtDialog(null);
      setMvtQty('');
      setMvtLabel('');
      qc.invalidateQueries({ queryKey: ['stock-produits'] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const filtered = produits.filter(p =>
    p.ref.toLowerCase().includes(search.toLowerCase()) ||
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  const enRupture = filtered.filter(p => p.stockReel <= 0);
  const alerteStock = filtered.filter(p => p.stockReel > 0 && p.stockMin > 0 && p.stockReel <= p.stockMin);
  const enStock = filtered.filter(p => p.stockReel > p.stockMin || (p.stockMin === 0 && p.stockReel > 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock & Entrepôts</h1>
          <p className="text-sm text-muted-foreground">{produits.length} produit(s) · {enRupture.length} en rupture</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un produit..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={selectedEntrepot} onValueChange={setSelectedEntrepot}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tous les entrepôts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les entrepôts</SelectItem>
            {entrepots.map(e => <SelectItem key={e.id} value={e.id}>{e.label || e.ref}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Résumé */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{enStock.length}</p>
              <p className="text-sm text-muted-foreground">En stock</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{alerteStock.length}</p>
              <p className="text-sm text-muted-foreground">Alerte stock</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Warehouse className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{enRupture.length}</p>
              <p className="text-sm text-muted-foreground">En rupture</p>
            </div>
          </div>
        </div>
      </div>

      {loadingProduits ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Désignation</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock réel</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Seuil alerte</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Prix HT</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Mouvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucun produit</td></tr>
              ) : filtered.map(p => {
                const alerte = p.stockMin > 0 && p.stockReel <= p.stockMin && p.stockReel > 0;
                const rupture = p.stockReel <= 0;
                return (
                  <tr key={p.id} className={cn('hover:bg-muted/30 transition-colors', rupture && 'bg-red-50/50', alerte && 'bg-yellow-50/50')}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.ref}</td>
                    <td className="px-4 py-3">{p.label}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.type}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold', rupture ? 'text-red-600' : alerte ? 'text-yellow-600' : 'text-green-600')}>
                      {p.stockReel}
                      {rupture && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{p.stockMin || '—'}</td>
                    <td className="px-4 py-3 text-right">{p.prixHT > 0 ? `${p.prixHT.toFixed(2)} €` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setMvtDialog(p)}>
                        Ajuster
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog mouvement de stock */}
      <Dialog open={!!mvtDialog} onOpenChange={open => !open && setMvtDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mouvement de stock</DialogTitle>
            {mvtDialog && <p className="text-sm text-muted-foreground">{mvtDialog.ref} — {mvtDialog.label}</p>}
          </DialogHeader>
          {!selectedEntrepot ? (
            <p className="text-sm text-yellow-600 py-4">Veuillez d'abord sélectionner un entrepôt.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={mvtSens === 'plus' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => setMvtSens('plus')}
                >
                  <Plus className="h-4 w-4" />Entrée
                </Button>
                <Button
                  variant={mvtSens === 'moins' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => setMvtSens('moins')}
                >
                  <Minus className="h-4 w-4" />Sortie
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">Quantité *</label>
                <Input type="number" value={mvtQty} onChange={e => setMvtQty(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <label className="text-sm font-medium">Motif</label>
                <Input value={mvtLabel} onChange={e => setMvtLabel(e.target.value)} placeholder="Réception fournisseur, vente..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMvtDialog(null)}>Annuler</Button>
                <Button onClick={() => mvtMut.mutate()} disabled={!mvtQty || parseFloat(mvtQty) <= 0 || mvtMut.isPending}>
                  {mvtMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
