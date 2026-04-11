import { useState } from 'react';
import { useProduits, useCreateProduit } from '@/hooks/useDolibarr';
import { Package, Wrench, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Catalogue() {
  const { data: produits = [] } = useProduits();
  const createProduitMutation = useCreateProduit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [tvaTx, setTvaTx] = useState(20);
  const [type, setType] = useState<'0' | '1'>('0'); // 0=produit, 1=service

  const handleCreate = async () => {
    if (!ref || !label) return;
    await createProduitMutation.mutateAsync({ ref, label, description, price, tva_tx: tvaTx, type: parseInt(type) });
    setDialogOpen(false);
    setRef(''); setLabel(''); setDescription(''); setPrice(0); setTvaTx(20); setType('0');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catalogue</h1>
          <p className="text-muted-foreground text-sm">Produits & services — endpoint /products</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Ajouter produit/service
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-lg">
            <DialogHeader><DialogTitle className="text-foreground">Nouveau produit/service</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={type} onValueChange={(v) => setType(v as '0' | '1')}>
                <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Produit</SelectItem>
                  <SelectItem value="1">Service</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Référence (ex: PRD-003)" value={ref} onChange={e => setRef(e.target.value)} className="glass border-border/50" />
              <Input placeholder="Libellé" value={label} onChange={e => setLabel(e.target.value)} className="glass border-border/50" />
              <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="glass border-border/50" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Prix HT (€)</label>
                  <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="glass border-border/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">TVA (%)</label>
                  <Input type="number" value={tvaTx} onChange={e => setTvaTx(Number(e.target.value))} className="glass border-border/50" />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={createProduitMutation.isPending || !ref || !label}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0 h-12 text-base"
              >
                {createProduitMutation.isPending ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produits.map((p) => (
          <div key={p.id} className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform group relative overflow-hidden">
            <div className={`absolute inset-0 opacity-5 ${p.type === 'service' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-green-600'}`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.type === 'service' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-green-600'}`}>
                  {p.type === 'service' ? <Wrench className="h-4 w-4 text-foreground" /> : <Package className="h-4 w-4 text-foreground" />}
                </div>
                <span className="text-xs font-mono text-muted-foreground">{p.ref}</span>
              </div>

              <h3 className="font-semibold text-foreground mb-1">{p.label}</h3>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.description}</p>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">{p.prixHT.toLocaleString('fr-FR')} €</p>
                  <p className="text-xs text-muted-foreground">HT</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-accent/30 px-2 py-0.5 text-xs text-muted-foreground">
                    TVA {p.tauxTVA}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{p.type}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
