import { useState } from 'react';
import { Euro, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures, useClients, useProduits, useCreateFacture } from '@/hooks/useDolibarr';
import { formatDateFR } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LigneForm {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type: number;
  productId: string;
}

export default function Factures() {
  const { data: factures = [] } = useFactures();
  const { data: clients = [] } = useClients();
  const { data: produits = [] } = useProduits();
  const createFactureMutation = useCreateFacture();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '' }]);

  const totalCA = factures.reduce((s, f) => s + f.montantTTC, 0);
  const payees = factures.filter(f => f.statut === 'payée');
  const impayees = factures.filter(f => f.statut !== 'payée');

  const emptyLigne = (): LigneForm => ({ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '' });
  const addLigne = () => setLignes([...lignes, emptyLigne()]);
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));

  const selectProduct = (i: number, productId: string) => {
    const updated = [...lignes];
    if (productId === '__libre__') {
      updated[i] = { ...updated[i], productId: '', desc: '' };
    } else {
      const p = produits.find(pr => pr.id === productId);
      if (p) {
        updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA, product_type: p.type === 'service' ? 1 : 0 };
      }
    }
    setLignes(updated);
  };

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    const updated = [...lignes];
    (updated[i] as any)[field] = value;
    setLignes(updated);
  };

  const handleCreate = async () => {
    if (!socid || lignes.length === 0 || !lignes[0].desc) return;
    await createFactureMutation.mutateAsync({
      socid,
      lines: lignes.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type })),
    });
    setDialogOpen(false);
    setSocid('');
    setLignes([emptyLigne()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Factures</h1>
          <p className="text-muted-foreground text-sm">Gestion des factures clients</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Créer une facture
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Nouvelle facture</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={socid} onValueChange={setSocid}>
                <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Lignes</h3>
                  <Button variant="outline" size="sm" onClick={addLigne} className="gap-1 glass border-border/50">
                    <Plus className="h-3 w-3" /> Ajouter
                  </Button>
                </div>
                {lignes.map((l, i) => (
                  <div key={i} className="space-y-2 p-3 rounded-lg bg-accent/10 border border-border/30">
                    <Select value={l.productId || '__libre__'} onValueChange={(v) => selectProduct(i, v)}>
                      <SelectTrigger className="glass border-border/50 text-xs">
                        <SelectValue placeholder="Sélectionner un produit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__libre__">✏️ Ligne libre</SelectItem>
                        {produits.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            [{p.ref}] — {p.label} ({p.type === 'service' ? 'Service' : 'Produit'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!l.productId && (
                      <Select value={String(l.product_type)} onValueChange={v => updateLigne(i, 'product_type', Number(v))}>
                        <SelectTrigger className="glass border-border/50 text-xs w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Produit</SelectItem>
                          <SelectItem value="1">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Input placeholder="Désignation" value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qté" value={l.qty} onChange={e => updateLigne(i, 'qty', Number(e.target.value))} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Prix HT" value={l.subprice} onChange={e => updateLigne(i, 'subprice', Number(e.target.value))} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="TVA%" value={l.tva_tx} onChange={e => updateLigne(i, 'tva_tx', Number(e.target.value))} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-1">
                        {lignes.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLigne(i)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleCreate}
                disabled={createFactureMutation.isPending || !socid}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0 h-12 text-base"
              >
                {createFactureMutation.isPending ? 'Création...' : 'Créer la facture'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total CA" value={`${totalCA.toLocaleString('fr-FR')} €`} icon={Euro} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
        <StatCard title="Factures payées" value={String(payees.length)} subtitle={`${payees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={CheckCircle} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
        <StatCard title="Factures impayées" value={String(impayees.length)} subtitle={`${impayees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={AlertCircle} gradient="bg-gradient-to-br from-orange-500 to-amber-600" />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant TTC</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{f.ref}</td>
                  <td className="py-3 px-2 text-foreground">{f.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{formatDateFR(f.date)}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                  <td className="py-3 px-2"><StatusBadge statut={f.statut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
