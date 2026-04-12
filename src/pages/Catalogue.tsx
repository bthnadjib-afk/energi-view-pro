import { useState } from 'react';
import { useProduits, useCreateProduit, useDeleteProduit, useUpdateProduit } from '@/hooks/useDolibarr';
import { Package, Wrench, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { type Produit } from '@/services/dolibarr';

export default function Catalogue() {
  const { data: produits = [] } = useProduits();
  const createProduitMutation = useCreateProduit();
  const deleteProduitMutation = useDeleteProduit();
  const updateProduitMutation = useUpdateProduit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Produit | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [type, setType] = useState<'0' | '1'>('1');

  const generateRef = (productType: '0' | '1') => {
    if (productType === '1') {
      const moItems = produits.filter(p => p.type === 'main_oeuvre');
      return `MO${String(moItems.length + 1).padStart(3, '0')}`;
    } else {
      const fItems = produits.filter(p => p.type === 'fourniture');
      return String(fItems.length + 1).padStart(4, '0');
    }
  };

  const handleCreate = async () => {
    if (!label) return;
    const ref = generateRef(type);
    await createProduitMutation.mutateAsync({ ref, label, description, price, tva_tx: 0, type: parseInt(type) });
    setDialogOpen(false);
    setLabel(''); setDescription(''); setPrice(0); setType('1');
  };

  const openEdit = (p: Produit) => {
    setEditProduct(p);
    setLabel(p.label);
    setDescription(p.description);
    setPrice(p.prixHT);
    setType(p.type === 'main_oeuvre' ? '1' : '0');
  };

  const handleEdit = async () => {
    if (!editProduct || !label) return;
    await updateProduitMutation.mutateAsync({ id: editProduct.id, label, description, price, type: parseInt(type) });
    setEditProduct(null);
    setLabel(''); setDescription(''); setPrice(0); setType('1');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catalogue</h1>
          <p className="text-muted-foreground text-sm">Main d'œuvre & Fournitures</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nouvel article</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={type} onValueChange={(v) => setType(v as '0' | '1')}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Main d'œuvre</SelectItem>
                  <SelectItem value="0">Fourniture</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Référence auto : <span className="font-mono text-foreground">{generateRef(type)}</span>
              </div>
              <Input placeholder="Libellé" value={label} onChange={e => setLabel(e.target.value)} />
              <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prix HT (€)</label>
                <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <Button onClick={handleCreate} disabled={createProduitMutation.isPending || !label} className="w-full h-12 text-base">
                {createProduitMutation.isPending ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produits.map((p) => (
          <div key={p.id} className="bg-card rounded-lg border border-border p-5 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="flex items-start justify-between mb-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.type === 'main_oeuvre' ? 'bg-violet-100' : 'bg-emerald-100'}`}>
                {p.type === 'main_oeuvre' ? <Wrench className="h-4 w-4 text-violet-600" /> : <Package className="h-4 w-4 text-emerald-600" />}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-muted-foreground">{p.ref}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
                      <AlertDialogDescription>L'article "{p.label}" sera définitivement supprimé.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteProduitMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <h3 className="font-semibold text-foreground mb-1">{p.label}</h3>
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-lg font-bold text-foreground">{p.prixHT.toLocaleString('fr-FR')} €</p>
                <p className="text-xs text-muted-foreground">HT</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground capitalize">{p.type === 'main_oeuvre' ? "Main d'œuvre" : 'Fourniture'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit product dialog */}
      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) { setEditProduct(null); setLabel(''); setDescription(''); setPrice(0); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier l'article</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Libellé" value={label} onChange={e => setLabel(e.target.value)} />
            <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prix HT (€)</label>
              <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
            </div>
            <Button onClick={handleEdit} disabled={updateProduitMutation.isPending || !label} className="w-full h-12 text-base">
              {updateProduitMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
