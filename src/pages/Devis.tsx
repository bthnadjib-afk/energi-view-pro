import { useState, Fragment } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useDevis, useClients, useProduits, useCreateDevis, useConvertDevisToFacture, useCreateAcompte } from '@/hooks/useDolibarr';
import { getAcompteBadge, formatDateFR, type Devis as DevisType } from '@/services/dolibarr';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowRightLeft, Receipt } from 'lucide-react';
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

function AcompteBadge({ montantTTC }: { montantTTC: number }) {
  const { label, variant } = getAcompteBadge(montantTTC);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      variant === 'green'
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    )}>
      {label}
    </span>
  );
}

function DevisDetail({ devis, onConvert, onAcompte, convertPending, acomptePending }: {
  devis: DevisType;
  onConvert: () => void;
  onAcompte: () => void;
  convertPending: boolean;
  acomptePending: boolean;
}) {
  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-accent/20 p-4 mx-2 mb-2 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground mb-2">Détail des lignes</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-1 text-muted-foreground">Désignation</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Qté</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Prix Unit.</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td className="py-2 px-1 text-foreground">{l.designation}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.quantite}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.prixUnitaire.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right font-medium text-foreground">{l.totalHT.toLocaleString('fr-FR')} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {devis.statut === 'accepté' && (
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/30">
              <Button
                onClick={onConvert}
                disabled={convertPending}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 border-0"
              >
                <ArrowRightLeft className="h-4 w-4" />
                {convertPending ? 'Conversion...' : 'Convertir en Facture'}
              </Button>
              <Button
                onClick={onAcompte}
                disabled={acomptePending}
                variant="outline"
                className="gap-2 glass border-border/50"
              >
                <Receipt className="h-4 w-4" />
                {acomptePending ? 'Création...' : 'Saisir un acompte'}
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Devis() {
  const { data: devis = [] } = useDevis();
  const { data: clients = [] } = useClients();
  const { data: produits = [] } = useProduits();
  const createDevisMutation = useCreateDevis();
  const convertMutation = useConvertDevisToFacture();
  const acompteMutation = useCreateAcompte();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '' }]);

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
    await createDevisMutation.mutateAsync({
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
          <h1 className="text-2xl font-bold text-foreground">Devis</h1>
          <p className="text-muted-foreground text-sm">Propositions commerciales et règle d'acompte</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Créer un devis
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Nouveau devis</DialogTitle></DialogHeader>
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
                disabled={createDevisMutation.isPending || !socid}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0 h-12 text-base"
              >
                {createDevisMutation.isPending ? 'Création...' : 'Créer le devis'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-8"></th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant TTC</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Statut</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Acompte</th>
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <Fragment key={d.id}>
                  <tr
                    className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  >
                    <td className="py-3 px-2">
                      {expandedId === d.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 px-2 font-mono text-xs text-foreground">{d.ref}</td>
                    <td className="py-3 px-2 text-foreground">{d.client}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{formatDateFR(d.date)}</td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">{d.montantTTC.toLocaleString('fr-FR')} €</td>
                    <td className="py-3 px-2 hidden md:table-cell"><StatusBadge statut={d.statut} /></td>
                    <td className="py-3 px-2"><AcompteBadge montantTTC={d.montantTTC} /></td>
                  </tr>
                  {expandedId === d.id && (
                    <DevisDetail
                      devis={d}
                      onConvert={() => convertMutation.mutate(d.id)}
                      onAcompte={() => acompteMutation.mutate({ socid: d.socid || '', montantTTC: d.montantTTC, devisRef: d.ref })}
                      convertPending={convertMutation.isPending}
                      acomptePending={acompteMutation.isPending}
                    />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
