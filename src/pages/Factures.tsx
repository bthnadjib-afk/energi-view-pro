import { useState, useMemo, useEffect } from 'react';
import { Euro, CheckCircle, AlertCircle, Plus, Trash2, FileCheck, FileDown, Send, CreditCard, Pencil, Search, XCircle, Zap } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures, useClients, useProduits, useCreateFacture, useDeleteFacture, useValidateFacture, useAddPayment, useUpdateFactureLines, useSetFactureToDraft, useSetFactureToUnpaid } from '@/hooks/useDolibarr';
import { useFactureRelances, useRecordFactureEnvoi, getRelanceStatus } from '@/hooks/useFactureRelances';
import { formatDateFR, sendFactureByEmail, type CreateDevisLine, type Facture, type Client } from '@/services/dolibarr';
import { openFacturePdf, facturePdfToBase64, facturePdfToBlobUrl } from '@/services/facturePdf';
import { useConfig } from '@/hooks/useConfig';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { persistLinesToCatalog } from '@/lib/catalogHelpers';
import { Checkbox } from '@/components/ui/checkbox';

interface LigneForm {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type: number; // 0 fourniture, 1 main d'œuvre
  productId: string;
  prixAchat: number;
  saveToCatalog?: boolean;
}

export default function Factures() {
  const { config } = useConfig();
  const { role } = useAuthContext();
  const queryClient = useQueryClient();
  const canRecordPayment = role === 'admin' || role === 'secretaire';
  const { data: factures = [] } = useFactures();
  const { data: relances = [] } = useFactureRelances();
  const recordEnvoi = useRecordFactureEnvoi();
  const relanceByFactureId = useMemo(() => {
    const map = new Map<string, typeof relances[0]>();
    relances.forEach(r => map.set(r.facture_id, r));
    return map;
  }, [relances]);
  const { data: clients = [] } = useClients();
  const { data: produits = [] } = useProduits();
  const createFactureMutation = useCreateFacture();
  const deleteFactureMutation = useDeleteFacture();
  const validateFactureMutation = useValidateFacture();
  const addPaymentMutation = useAddPayment();
  const updateLinesMutation = useUpdateFactureLines();
  const setToDraftMutation = useSetFactureToDraft();
  const setToUnpaidMutation = useSetFactureToUnpaid();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; nom: string; objet: string; corps: string }[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRef, setPdfPreviewRef] = useState('');

  useEffect(() => {
    if (emailOpen) {
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase.from('email_templates').select('*').then(({ data }) => {
          if (data) setEmailTemplates(data as any);
        });
      });
    }
  }, [emailOpen]);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '', prixAchat: 0 }]);

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState(4);

  // Edit draft state
  const [editOpen, setEditOpen] = useState(false);
  const [editLines, setEditLines] = useState<LigneForm[]>([]);

  // Filters
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered factures
  const filteredFactures = useMemo(() => {
    return factures.filter(f => {
      if (filterStatut !== 'all') {
        if (filterStatut === 'brouillon' && f.fk_statut !== 0) return false;
        if (filterStatut === 'impayee' && (f.fk_statut < 1 || f.paye || f.totalPaye > 0)) return false;
        if (filterStatut === 'partielle' && !(f.fk_statut >= 1 && !f.paye && f.totalPaye > 0)) return false;
        if (filterStatut === 'payee' && !f.paye) return false;
        if (filterStatut === 'abandonnee' && f.fk_statut !== 3) return false;
      }
      if (filterClient !== 'all' && f.socid !== filterClient) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!f.ref.toLowerCase().includes(q) && !f.client.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [factures, filterStatut, filterClient, searchQuery]);

  const totalCA = factures.reduce((s, f) => s + f.montantTTC, 0);
  const payees = factures.filter(f => f.paye);
  const nonPayees = factures.filter(f => !f.paye && f.fk_statut >= 1);

  const emptyLigne = (): LigneForm => ({ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '', prixAchat: 0 });
  const addLigne = () => setLignes([...lignes, emptyLigne()]);
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));

  const selectProduct = (i: number, productId: string) => {
    const updated = [...lignes];
    if (productId === '__libre__') {
      updated[i] = { ...updated[i], productId: '', desc: '' };
    } else {
      const p = produits.find(pr => pr.id === productId);
      if (p) {
        updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA || 20, product_type: p.type === 'main_oeuvre' ? 1 : 0, prixAchat: p.prixAchat || 0 };
      }
    }
    setLignes(updated);
  };

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    const updated = [...lignes];
    (updated[i] as any)[field] = value;
    setLignes(updated);
  };

  const totals = useMemo(() => {
    const ht = lignes.reduce((s, l) => s + l.qty * l.subprice, 0);
    const tva = lignes.reduce((s, l) => s + l.qty * l.subprice * l.tva_tx / 100, 0);
    return { ht, tva, ttc: ht + tva };
  }, [lignes]);

  const handleCreate = async () => {
    if (!socid || lignes.length === 0 || !lignes[0].desc) return;
    await createFactureMutation.mutateAsync({
      socid,
      lines: lignes.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type, pa_ht: l.prixAchat })),
    });
    try {
      const created = await persistLinesToCatalog(lignes, produits as any);
      if (created > 0) {
        toast.success(`${created} article(s) ajouté(s) au catalogue`);
        queryClient.invalidateQueries({ queryKey: ['produits'] });
      }
    } catch {}
    setDialogOpen(false);
    setSocid('');
    setLignes([emptyLigne()]);
  };

  const handleValidate = async () => {
    if (!selectedFacture) return;
    try {
      await validateFactureMutation.mutateAsync(selectedFacture.id);
      setSelectedFacture(null);
    } catch {}
  };

  const handlePayment = async () => {
    if (!selectedFacture || paymentAmount <= 0) return;
    const reste = selectedFacture.resteAPayer;
    try {
      await addPaymentMutation.mutateAsync({
        invoiceId: selectedFacture.id,
        datepaye: paymentDate,
        paymentid: paymentMode,
        closepaidinvoices: (reste - paymentAmount) <= 0.01 ? 'yes' : 'no',
        amount: paymentAmount,
      });
      setPaymentOpen(false);
      setSelectedFacture(null);
    } catch {}
  };

  const openEditDraft = (f: Facture) => {
    // Load real lines from the facture
    if (f.lignes && f.lignes.length > 0) {
      setEditLines(f.lignes.map(l => ({
        desc: l.designation,
        qty: l.quantite,
        subprice: l.prixUnitaire,
        tva_tx: 20,
        product_type: 1,
        productId: '',
        prixAchat: l.prixAchat || 0,
      })));
    } else {
      setEditLines([{ desc: '', qty: 1, subprice: f.montantHT, tva_tx: 20, product_type: 1, productId: '', prixAchat: 0 }]);
    }
    setEditOpen(true);
  };

  const handleSaveEditLines = async () => {
    if (!selectedFacture) return;
    try {
      await updateLinesMutation.mutateAsync({
        id: selectedFacture.id,
        socid: selectedFacture.socid || '',
        lines: editLines.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type, pa_ht: l.prixAchat })),
      });
      try {
        const created = await persistLinesToCatalog(editLines, produits as any);
        if (created > 0) {
          toast.success(`${created} article(s) ajouté(s) au catalogue`);
          queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
      } catch {}
      setEditOpen(false);
      setSelectedFacture(null);
    } catch {}
  };

  // Totals for edit lines (live preview in edit dialog)
  const editTotals = useMemo(() => {
    const ht = editLines.reduce((s, l) => s + l.qty * l.subprice, 0);
    const tva = editLines.reduce((s, l) => s + l.qty * l.subprice * l.tva_tx / 100, 0);
    return { ht, tva, ttc: ht + tva };
  }, [editLines]);

  const selectEditProduct = (i: number, productId: string) => {
    const updated = [...editLines];
    if (productId === '__libre__') {
      updated[i] = { ...updated[i], productId: '', desc: '' };
    } else {
      const p = produits.find(pr => pr.id === productId);
      if (p) {
        updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA || 20, product_type: p.type === 'main_oeuvre' ? 1 : 0, prixAchat: p.prixAchat || 0 };
      }
    }
    setEditLines(updated);
  };

  // Unique clients in factures for filter
  const factureClients = useMemo(() => {
    const map = new Map<string, string>();
    factures.forEach(f => { if (f.socid) map.set(f.socid, f.client); });
    return Array.from(map.entries());
  }, [factures]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Factures</h1>
          <p className="text-muted-foreground text-sm">Gestion des factures — statuts natifs Dolibarr</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Créer une facture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle facture (Brouillon)</DialogTitle>
              <DialogDescription className="sr-only">Formulaire de création de facture</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={socid} onValueChange={setSocid}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Lignes de la facture</h3>
                  <Button variant="outline" size="sm" onClick={addLigne} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Ajouter une ligne</Button>
                </div>
                {lignes.map((l, i) => {
                  const ligneHT = l.qty * l.subprice;
                  return (
                    <div key={i} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ligne {i + 1}</span>
                        {lignes.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeLigne(i)}>
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Article du catalogue (optionnel)</label>
                        <Select value={l.productId || '__libre__'} onValueChange={(v) => selectProduct(i, v)}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Choisir un article..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__libre__">✏️ Ligne libre (saisie manuelle)</SelectItem>
                            {produits.map(p => <SelectItem key={p.id} value={p.id}>[{p.ref}] {p.label} — {p.prixHT.toLocaleString('fr-FR')} € HT ({p.type === 'main_oeuvre' ? "Main d'œuvre" : 'Fourniture'})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Désignation *</label>
                        <Input placeholder="Description de la prestation ou fourniture..." value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Quantité</label>
                          <Input type="number" min="0" step="0.01" value={l.qty} onChange={e => updateLigne(i, 'qty', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Prix unitaire HT (€)</label>
                          <Input type="number" min="0" step="0.01" value={l.subprice} onChange={e => updateLigne(i, 'subprice', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">TVA (%)</label>
                          <Input type="number" min="0" step="0.01" value={l.tva_tx} onChange={e => updateLigne(i, 'tva_tx', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Total HT</label>
                          <div className="h-10 flex items-center px-3 rounded-md bg-background border border-border text-sm font-semibold text-foreground">
                            {ligneHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </div>
                        </div>
                      </div>

                      {/* Type + Sauver dans catalogue (lignes libres uniquement) */}
                      {!l.productId && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Type :</label>
                            <Select value={String(l.product_type)} onValueChange={(v) => updateLigne(i, 'product_type', Number(v))}>
                              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">🔧 Main d'œuvre</SelectItem>
                                <SelectItem value="0">📦 Fourniture</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                            <Checkbox checked={!!l.saveToCatalog} onCheckedChange={(v) => { const u = [...lignes]; u[i].saveToCatalog = !!v; setLignes(u); }} />
                            <span>Ajouter au catalogue</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="text-foreground font-medium">{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA</span>
                  <span className="text-foreground">{totals.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
                  <span className="text-foreground">Total TTC</span>
                  <span className="text-primary">{totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={createFactureMutation.isPending || !socid} className="w-full h-12 text-base">
                {createFactureMutation.isPending ? 'Création...' : 'Créer la facture (Brouillon)'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total CA TTC" value={`${totalCA.toLocaleString('fr-FR')} €`} icon={Euro} />
        <StatCard title="Factures payées" value={String(payees.length)} subtitle={`${payees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={CheckCircle} />
        <StatCard title="Factures non payées" value={String(nonPayees.length)} subtitle={`${nonPayees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={AlertCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher ref ou client..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="impayee">Non payée</SelectItem>
            <SelectItem value="partielle">Partiellement payée</SelectItem>
            <SelectItem value="payee">Payée</SelectItem>
            <SelectItem value="abandonnee">Abandonnée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {factureClients.map(([id, nom]) => (
              <SelectItem key={id} value={id}>{nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant TTC</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Reste à payer</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredFactures.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedFacture(f)}>
                  <td className="py-3 px-2 font-mono text-xs text-foreground">
                    <div className="flex items-center gap-1.5">
                      {f.ref}
                      {(() => {
                        try {
                          const meta = f.note_private ? JSON.parse(f.note_private) : null;
                          if (meta?.from_intervention) {
                            return (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 text-[10px] font-medium" title={`Depuis intervention ${meta.from_intervention}`}>
                                <Zap className="h-2.5 w-2.5" />↩ {meta.from_intervention}
                              </span>
                            );
                          }
                        } catch {}
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-foreground">{f.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">
                    {(() => {
                      const r = relanceByFactureId.get(f.id);
                      if (r?.date_envoi) {
                        return (
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground/70">Envoyée le</span>
                            <span>{formatDateFR(r.date_envoi)}</span>
                          </div>
                        );
                      }
                      return formatDateFR(f.date);
                    })()}
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                  <td className="py-3 px-2 text-right text-muted-foreground hidden md:table-cell">
                    {f.fk_statut >= 1 && !f.paye ? `${f.resteAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}
                  </td>
                  <td className="py-3 px-2">
                    {(() => {
                      const r = relanceByFactureId.get(f.id);
                      const rel = getRelanceStatus(r, f.paye, f.dateValidation);
                      if (f.fk_statut >= 1 && !f.paye && (rel.variant === 'relance_1' || rel.variant === 'mise_en_demeure')) {
                        const combined = rel.variant === 'mise_en_demeure'
                          ? 'Non payée — Mise en demeure'
                          : 'Non payée — 1ère relance';
                        return <StatusBadge statut={combined} />;
                      }
                      return <StatusBadge statut={f.statut} />;
                    })()}
                  </td>
                  <td className="py-3 px-2" onClick={e => e.stopPropagation()}>
                    {f.fk_statut === 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer {f.ref} ?</AlertDialogTitle>
                            <AlertDialogDescription>Suppression définitive.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteFactureMutation.mutate(f.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
              {filteredFactures.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucune facture trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facture detail dialog */}
      <Dialog open={!!selectedFacture} onOpenChange={(open) => { if (!open) setSelectedFacture(null); }}>
        <DialogContent className="max-w-lg">
          {selectedFacture && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedFacture.ref}</DialogTitle>
                <DialogDescription className="sr-only">Détails de la facture</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Client :</span> <span className="text-foreground ml-1">{selectedFacture.client}</span></div>
                  <div><span className="text-muted-foreground">Date :</span> <span className="text-foreground ml-1">{formatDateFR(selectedFacture.date)}</span></div>
                  <div><span className="text-muted-foreground">Montant HT :</span> <span className="text-foreground ml-1">{selectedFacture.montantHT.toLocaleString('fr-FR')} €</span></div>
                  <div><span className="text-muted-foreground">Montant TTC :</span> <span className="text-foreground ml-1 font-bold">{selectedFacture.montantTTC.toLocaleString('fr-FR')} €</span></div>
                  {selectedFacture.fk_statut >= 1 && !selectedFacture.paye && (
                    <>
                      <div><span className="text-muted-foreground">Déjà payé :</span> <span className="text-foreground ml-1">{selectedFacture.totalPaye.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
                      <div><span className="text-muted-foreground">Reste à payer :</span> <span className="text-foreground ml-1 font-bold text-orange-600">{selectedFacture.resteAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
                    </>
                  )}
                </div>

                {/* Show lines */}
                {selectedFacture.lignes && selectedFacture.lignes.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase">Lignes</h4>
                    <div className="rounded border border-border divide-y divide-border text-xs">
                      {selectedFacture.lignes.map((l, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <span className="text-foreground flex-1 truncate">{l.designation}</span>
                          <span className="text-muted-foreground mx-2">{l.quantite} × {l.prixUnitaire.toLocaleString('fr-FR')} €</span>
                          <span className="text-foreground font-medium">{l.totalHT.toLocaleString('fr-FR')} €</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Statut :</span>
                  <StatusBadge statut={selectedFacture.statut} />
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {/* Brouillon actions */}
                  {selectedFacture.fk_statut === 0 && (
                    <>
                      <Button
                        onClick={handleValidate}
                        disabled={validateFactureMutation.isPending}
                        className="gap-2"
                      >
                        <FileCheck className="h-4 w-4" />
                        {validateFactureMutation.isPending ? 'Validation...' : 'Valider'}
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => openEditDraft(selectedFacture)}
                      >
                        <Pencil className="h-4 w-4" /> Modifier les lignes
                      </Button>
                    </>
                  )}

                  {/* Validated → back to draft */}
                  {selectedFacture.fk_statut === 1 && !selectedFacture.paye && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        await setToDraftMutation.mutateAsync(selectedFacture.id);
                        setSelectedFacture(null);
                      }}
                      disabled={setToDraftMutation.isPending}
                    >
                      {setToDraftMutation.isPending ? 'En cours...' : 'Repasser en brouillon'}
                    </Button>
                  )}

                  {/* Paid → back to unpaid */}
                  {selectedFacture.paye && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        await setToUnpaidMutation.mutateAsync(selectedFacture.id);
                        setSelectedFacture(null);
                      }}
                      disabled={setToUnpaidMutation.isPending}
                    >
                      {setToUnpaidMutation.isPending ? 'En cours...' : 'Repasser en impayée'}
                    </Button>
                  )}

                  {selectedFacture.fk_statut >= 1 && !selectedFacture.paye && selectedFacture.fk_statut !== 3 && canRecordPayment && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setPaymentAmount(selectedFacture.resteAPayer);
                        setPaymentDate(new Date().toISOString().slice(0, 10));
                        setPaymentOpen(true);
                      }}
                    >
                      <CreditCard className="h-4 w-4" /> Enregistrer un paiement
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      try {
                        const client = clients.find((c: Client) => c.id === selectedFacture.socid);
                        const url = facturePdfToBlobUrl({ facture: selectedFacture, client, entreprise: config.entreprise });
                        setPdfPreviewUrl(url);
                        setPdfPreviewRef(selectedFacture.ref);
                        setPdfPreviewOpen(true);
                      } catch (e: any) { toast.error(`Erreur PDF : ${e.message || e}`); }
                    }}
                  >
                    <FileDown className="h-4 w-4" /> Voir le PDF
                  </Button>
                  {selectedFacture.fk_statut >= 1 && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        const c = clients.find(cl => cl.id === selectedFacture.socid);
                        setEmailDest(c?.email || '');
                        setEmailObjet(`Électricien du Genevois - Facture ${selectedFacture.ref}`);
                        setEmailMessage(`Bonjour,\n\nVous trouverez ci-joint votre facture ${selectedFacture.ref} d'un montant de ${selectedFacture.montantTTC.toLocaleString('fr-FR')} € TTC.\n\nMerci de procéder au règlement dans les meilleurs délais.\n\nCordialement,\nÉlectricien du Genevois`);
                        setEmailOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4" /> Envoyer par email
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription className="sr-only">Formulaire de paiement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedFacture && (
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Facture</span><span className="text-foreground font-mono">{selectedFacture.ref}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Montant TTC</span><span className="text-foreground">{selectedFacture.montantTTC.toLocaleString('fr-FR')} €</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span className="text-foreground">{selectedFacture.totalPaye.toLocaleString('fr-FR')} €</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-1"><span className="text-foreground">Reste à payer</span><span className="text-orange-600">{selectedFacture.resteAPayer.toLocaleString('fr-FR')} €</span></div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Montant (€)</label>
              <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(Number(e.target.value))} step="0.01" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Date du paiement</label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Mode de paiement</label>
              <Select value={String(paymentMode)} onValueChange={v => setPaymentMode(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Carte bancaire</SelectItem>
                  <SelectItem value="6">Virement</SelectItem>
                  <SelectItem value="7">Chèque</SelectItem>
                  <SelectItem value="2">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePayment} disabled={addPaymentMutation.isPending || paymentAmount <= 0} className="w-full">
              {addPaymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit draft lines dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les lignes — {selectedFacture?.ref}</DialogTitle>
            <DialogDescription className="sr-only">Modification des lignes de facture</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Lignes de la facture</h3>
                <Button variant="outline" size="sm" onClick={() => setEditLines([...editLines, emptyLigne()])} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                </Button>
              </div>
              {editLines.map((l, i) => {
                const ligneHT = l.qty * l.subprice;
                return (
                  <div key={i} className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ligne {i + 1}</span>
                      {editLines.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setEditLines(editLines.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-3.5 w-3.5" /> Supprimer
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Article du catalogue (optionnel)</label>
                      <Select value={l.productId || '__libre__'} onValueChange={(v) => selectEditProduct(i, v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Choisir un article..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__libre__">✏️ Ligne libre (saisie manuelle)</SelectItem>
                          {produits.map(p => <SelectItem key={p.id} value={p.id}>[{p.ref}] {p.label} — {p.prixHT.toLocaleString('fr-FR')} € HT ({p.type === 'main_oeuvre' ? "Main d'œuvre" : 'Fourniture'})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Désignation *</label>
                      <Input placeholder="Description de la prestation ou fourniture..." value={l.desc} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], desc: e.target.value }; setEditLines(u); }} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Quantité</label>
                        <Input type="number" min="0" step="0.01" value={l.qty} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], qty: Number(e.target.value) }; setEditLines(u); }} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Prix unitaire HT (€)</label>
                        <Input type="number" min="0" step="0.01" value={l.subprice} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], subprice: Number(e.target.value) }; setEditLines(u); }} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">TVA (%)</label>
                        <Input type="number" min="0" step="0.01" value={l.tva_tx} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], tva_tx: Number(e.target.value) }; setEditLines(u); }} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Total HT</label>
                        <div className="h-10 flex items-center px-3 rounded-md bg-background border border-border text-sm font-semibold text-foreground">
                          {ligneHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </div>
                      </div>
                    </div>

                    {/* Type + Sauver dans catalogue (lignes libres uniquement) */}
                    {!l.productId && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Type :</label>
                          <Select value={String(l.product_type)} onValueChange={(v) => { const u = [...editLines]; u[i] = { ...u[i], product_type: Number(v) }; setEditLines(u); }}>
                            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">🔧 Main d'œuvre</SelectItem>
                              <SelectItem value="0">📦 Fourniture</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                          <Checkbox checked={!!l.saveToCatalog} onCheckedChange={(v) => { const u = [...editLines]; u[i] = { ...u[i], saveToCatalog: !!v }; setEditLines(u); }} />
                          <span>Ajouter au catalogue</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                <p className="text-lg font-bold text-foreground">{editTotals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
              </div>
              <div className="text-center border-x border-border">
                <p className="text-xs text-muted-foreground mb-1">TVA</p>
                <p className="text-lg font-bold text-foreground">{editTotals.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total TTC</p>
                <p className="text-lg font-bold text-primary">{editTotals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
              </div>
            </div>

            <Button onClick={handleSaveEditLines} disabled={updateLinesMutation.isPending} className="w-full h-12 text-base">
              {updateLinesMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Envoyer la facture par email</DialogTitle>
            <DialogDescription className="sr-only">Formulaire d'envoi par email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!config.smtp.user && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                ⚠️ SMTP non configuré — rendez-vous dans <strong>Configuration → Serveur mail</strong> pour activer l'envoi.
              </div>
            )}
            {emailTemplates.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Modèle d'email</label>
                <Select onValueChange={id => {
                  const tmpl = emailTemplates.find(t => t.id === id);
                  if (!tmpl || !selectedFacture) return;
                  const client = clients.find((c: Client) => c.id === selectedFacture.socid);
                  const vars: Record<string, string> = {
                    NOM_CLIENT: client?.nom || selectedFacture.client,
                    REF_FACTURE: selectedFacture.ref,
                    MONTANT_TTC: `${selectedFacture.montantTTC.toLocaleString('fr-FR')} €`,
                    NOM_ENTREPRISE: config.entreprise.nom || 'Notre entreprise',
                  };
                  const replace = (t: string) => t.replace(/\[([A-Z_]+)\]/g, (_, k) => vars[k] || `[${k}]`);
                  setEmailObjet(replace(tmpl.objet));
                  setEmailMessage(replace(tmpl.corps));
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir un modèle (optionnel)" /></SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destinataire *</label>
              <Input value={emailDest} onChange={e => setEmailDest(e.target.value)} placeholder="client@exemple.fr" type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Objet</label>
              <Input value={emailObjet} onChange={e => setEmailObjet(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Message</label>
              <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="min-h-[120px]" placeholder="Corps du message..." />
            </div>
            <Button
              onClick={async () => {
                if (!selectedFacture || !emailDest) return;
                if (!config.smtp.user || !config.smtp.pass) {
                  toast.error('SMTP non configuré. Allez dans Configuration → Serveur mail.');
                  return;
                }
                setSendingEmail(true);
                try {
                  const client = clients.find((c: Client) => c.id === selectedFacture.socid);
                  const pdfBase64 = facturePdfToBase64({ facture: selectedFacture, client, entreprise: config.entreprise });
                  const { supabase } = await import('@/integrations/supabase/client');
                  const { data, error } = await supabase.functions.invoke('send-email-smtp', {
                    body: {
                      to: emailDest,
                      subject: emailObjet || `Facture ${selectedFacture.ref}`,
                      message: emailMessage,
                      pdfBase64,
                      pdfFilename: `${selectedFacture.ref}.pdf`,
                      smtpHost: config.smtp.host,
                      smtpPort: config.smtp.port || '465',
                      smtpUser: config.smtp.user,
                      smtpPass: config.smtp.pass,
                    },
                  });
                  if (error) throw new Error(error.message);
                  if (data && !data.ok) throw new Error(data.error || 'Erreur SMTP');
                  // Enregistrer la date d'envoi pour le suivi des relances
                  try {
                    await recordEnvoi.mutateAsync({
                      facture_id: selectedFacture.id,
                      facture_ref: selectedFacture.ref,
                      client_email: emailDest,
                    });
                  } catch (e) {
                    console.error('Erreur enregistrement date envoi:', e);
                  }
                  toast.success(`Facture ${selectedFacture.ref} envoyée à ${emailDest}`);
                  setEmailOpen(false);
                } catch (e: any) {
                  toast.error(`Erreur envoi : ${e.message || e}`);
                }
                setSendingEmail(false);
              }}
              disabled={sendingEmail || !emailDest}
              className="w-full"
            >
              {sendingEmail ? 'Envoi en cours...' : 'Envoyer avec le PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF preview dialog */}
      <Dialog open={pdfPreviewOpen} onOpenChange={(open) => {
        setPdfPreviewOpen(open);
        if (!open && pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Aperçu de la facture {pdfPreviewRef}</DialogTitle>
            <DialogDescription className="sr-only">Prévisualisation PDF</DialogDescription>
          </DialogHeader>
          {pdfPreviewUrl && (
            <iframe src={pdfPreviewUrl} className="w-full flex-1 rounded border border-border" title={`Facture ${pdfPreviewRef}`} />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => pdfPreviewUrl && window.open(pdfPreviewUrl, '_blank')}>
              Ouvrir dans un nouvel onglet
            </Button>
            <Button onClick={() => {
              const a = document.createElement('a');
              a.href = pdfPreviewUrl || '';
              a.download = `${pdfPreviewRef}.pdf`;
              a.click();
            }}>
              Télécharger
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
