import { useState } from 'react';
import {
  useProductGroups, useCreateProductGroup, useUpdateProductGroup, useDeleteProductGroup,
} from '@/hooks/useProductGroups';
import { useProduits } from '@/hooks/useDolibarr';
import type { ProductGroup, GroupLine } from '@/services/productGroups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Layers, Plus, Trash2, Pencil, Package, Wrench, AlertCircle, Loader2 } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';
import { cn } from '@/lib/utils';

interface LineForm extends GroupLine {
  productId: string;
}

const emptyLine = (): LineForm => ({
  desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0,
  prixAchat: 0, variable_qty: false, productId: '',
});

function LineEditor({
  lines, onChange, produits,
}: {
  lines: LineForm[];
  onChange: (lines: LineForm[]) => void;
  produits: { id: string; ref: string; label: string; prixHT: number; tauxTVA: number; type: string; prixAchat?: number }[];
}) {
  const update = (i: number, patch: Partial<LineForm>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
  const add = () => onChange([...lines, emptyLine()]);

  const selectProduct = (i: number, productId: string) => {
    if (productId === '__libre__') { update(i, { productId: '', desc: '' }); return; }
    const p = produits.find(pr => pr.id === productId);
    if (p) update(i, {
      productId,
      desc: `[${p.ref}] ${p.label}`,
      subprice: p.prixHT,
      tva_tx: p.tauxTVA || 20,
      product_type: p.type === 'main_oeuvre' ? 1 : 0,
      prixAchat: p.prixAchat || 0,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Lignes du lot</p>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </Button>
      </div>

      {lines.map((l, i) => (
        <div key={i} className={cn(
          'p-3 rounded-lg border space-y-2',
          l.variable_qty ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border bg-muted/30',
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ligne {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={l.variable_qty}
                  onChange={e => update(i, { variable_qty: e.target.checked })}
                  className="rounded"
                />
                <AlertCircle className="h-3 w-3" /> Qté à définir
              </label>
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          <Select value={l.productId || '__libre__'} onValueChange={v => selectProduct(i, v)}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Choisir un article du catalogue..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__libre__">✏️ Ligne libre</SelectItem>
              {produits.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  [{p.ref}] {p.label} — {p.prixHT.toLocaleString('fr-FR')} € HT
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Désignation *"
            value={l.desc}
            onChange={e => update(i, { desc: e.target.value })}
            className="text-sm"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {l.variable_qty ? '⚠ Quantité (défaut)' : 'Quantité'}
              </label>
              <Input
                type="number" min="0" step="0.01"
                value={l.qty}
                onChange={e => update(i, { qty: Number(e.target.value) })}
                className={cn('text-xs', l.variable_qty && 'border-amber-400')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prix unit. HT (€)</label>
              <Input
                type="number" min="0" step="0.01"
                value={l.subprice}
                onChange={e => update(i, { subprice: Number(e.target.value) })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prix achat HT (€)</label>
              <Input
                type="number" min="0" step="0.01"
                value={l.prixAchat}
                onChange={e => update(i, { prixAchat: Number(e.target.value) })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <Select
                value={String(l.product_type)}
                onValueChange={v => update(i, { product_type: Number(v) })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0"><Package className="inline h-3 w-3 mr-1" />Fourniture</SelectItem>
                  <SelectItem value="1"><Wrench className="inline h-3 w-3 mr-1" />Main d'œuvre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      {lines.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">Ajoutez au moins une ligne</p>
      )}
    </div>
  );
}

export default function Lots() {
  const { data: groups = [], isLoading } = useProductGroups();
  const { data: produits = [] } = useProduits();
  const createMutation = useCreateProductGroup();
  const updateMutation = useUpdateProductGroup();
  const deleteMutation = useDeleteProductGroup();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ProductGroup | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const openCreate = () => {
    setEditGroup(null);
    setNom('');
    setDescription('');
    setLines([emptyLine()]);
    setDialogOpen(true);
  };

  const openEdit = (g: ProductGroup) => {
    setEditGroup(g);
    setNom(g.nom);
    setDescription(g.description);
    setLines(g.lines.map(l => ({ ...l, productId: '' })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nom.trim() || lines.length === 0 || lines.every(l => !l.desc.trim())) return;
    const payload = {
      nom: nom.trim(),
      description: description.trim(),
      lines: lines.filter(l => l.desc.trim()).map(({ productId, ...l }) => l),
    };
    if (editGroup) {
      await updateMutation.mutateAsync({ id: editGroup.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const totalHT = (g: ProductGroup) =>
    g.lines.reduce((s, l) => s + l.qty * l.subprice, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Forfaits
            <HelpTooltip text="Les forfaits sont des groupes d'articles pré-définis. Créez-en un pour chaque type de chantier fréquent (ex. borne de recharge). Lors de la création d'un devis, cliquez 'Insérer un forfait' pour pré-remplir toutes les lignes automatiquement. Les lignes marquées ⚠ ont une quantité variable à saisir." />
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Créez des forfaits prédéfinis à insérer en un clic dans vos devis
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Créer un forfait
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground font-medium">Aucun forfait créé</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Créez des forfaits pour regrouper vos articles habituels (ex : "Borne IRVE", "Tableau électrique") et les insérer en un clic dans vos devis.
          </p>
          <Button onClick={openCreate} className="gap-2 mt-2">
            <Plus className="h-4 w-4" /> Créer mon premier forfait
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(g => {
            const nbVariable = g.lines.filter(l => l.variable_qty).length;
            const ht = totalHT(g);
            return (
              <div key={g.id} className="bg-card rounded-lg border border-border p-5 shadow-sm space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{g.nom}</h3>
                    {g.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le lot "{g.nom}" ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(g.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Aperçu des lignes */}
                <div className="flex-1 space-y-1">
                  {g.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {l.product_type === 1
                          ? <Wrench className="h-3 w-3 text-blue-500 shrink-0" />
                          : <Package className="h-3 w-3 text-emerald-500 shrink-0" />}
                        <span className="text-foreground truncate">{l.desc}</span>
                        {l.variable_qty && (
                          <span className="shrink-0 text-amber-600 font-medium">⚠</span>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {l.variable_qty ? '? ×' : `${l.qty} ×`} {l.subprice.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer stats */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">{g.lines.length} ligne{g.lines.length > 1 ? 's' : ''}{nbVariable > 0 ? ` · ${nbVariable} qté variable` : ''}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {ht > 0 ? `≈ ${ht.toLocaleString('fr-FR')} € HT` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog créer / modifier */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGroup ? `Modifier — ${editGroup.nom}` : 'Nouveau lot'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Nom du lot *</label>
                <Input
                  placeholder="ex : Borne IRVE, Tableau divisionnaire..."
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Input
                  placeholder="Description courte (optionnel)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Astuce variable_qty */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Cochez <strong>«&nbsp;Qté à définir&nbsp;»</strong> sur les lignes dont la quantité change à chaque devis
                (ex : câble en mètre linéaire). La quantité sera à saisir lors de l'insertion dans le devis.
              </span>
            </div>

            <LineEditor lines={lines} onChange={setLines} produits={produits} />

            <Button
              onClick={handleSave}
              disabled={isPending || !nom.trim() || lines.every(l => !l.desc.trim())}
              className="w-full h-11 text-base"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isPending ? 'Enregistrement...' : editGroup ? 'Enregistrer les modifications' : 'Créer le lot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
