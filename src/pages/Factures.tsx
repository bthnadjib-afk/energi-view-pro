import { useState, useMemo } from 'react';
import { Euro, CheckCircle, AlertCircle, Plus, Trash2, FileCheck, FileDown, Send, CreditCard, Pencil } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures, useClients, useProduits, useCreateFacture, useDeleteFacture, useValidateFacture, useAddPayment, useUpdateFactureLines } from '@/hooks/useDolibarr';
import { formatDateFR, generatePDF, openPDFInNewTab, downloadPDFUrl, sendFactureByEmail, type CreateDevisLine } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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
  const deleteFactureMutation = useDeleteFacture();
  const validateFactureMutation = useValidateFacture();
  const addPaymentMutation = useAddPayment();
  const updateLinesMutation = useUpdateFactureLines();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '' }]);

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState(4); // 4=CB, 6=Virement, 7=Chèque

  // Edit draft state
  const [editOpen, setEditOpen] = useState(false);
  const [editLines, setEditLines] = useState<LigneForm[]>([]);

  const totalCA = factures.reduce((s, f) => s + f.montantTTC, 0);
  const payees = factures.filter(f => f.paye);
  const nonPayees = factures.filter(f => !f.paye && f.fk_statut >= 1);

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
        updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA || 20, product_type: p.type === 'main_oeuvre' ? 1 : 0 };
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
      lines: lignes.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type })),
    });
    setDialogOpen(false);
    setSocid('');
    setLignes([emptyLigne()]);
  };

  const handlePayment = async () => {
    if (!selectedFacture || paymentAmount <= 0) return;
    await addPaymentMutation.mutateAsync({
      invoiceId: selectedFacture.id,
      datepaye: paymentDate,
      paymentid: paymentMode,
      closepaidinvoices: paymentAmount >= selectedFacture.montantTTC ? 'yes' : 'no',
      amount: paymentAmount,
    });
    setPaymentOpen(false);
    setSelectedFacture(null);
  };

  const openEditDraft = (f: any) => {
    // We don't have lines from the list view, start with a placeholder
    setEditLines([{ desc: 'Chargement...', qty: 1, subprice: f.montantHT, tva_tx: 20, product_type: 1, productId: '' }]);
    setEditOpen(true);
  };

  const handleSaveEditLines = async () => {
    if (!selectedFacture) return;
    await updateLinesMutation.mutateAsync({
      id: selectedFacture.id,
      socid: selectedFacture.socid || '',
      lines: editLines.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type })),
    });
    setEditOpen(false);
    setSelectedFacture(null);
  };

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
                  <h3 className="text-sm font-medium text-foreground">Lignes</h3>
                  <Button variant="outline" size="sm" onClick={addLigne} className="gap-1"><Plus className="h-3 w-3" /> Ajouter</Button>
                </div>
                {lignes.map((l, i) => (
                  <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                    <Select value={l.productId || '__libre__'} onValueChange={(v) => selectProduct(i, v)}>
                      <SelectTrigger className="text-xs"><SelectValue placeholder="Sélectionner un article" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__libre__">✏️ Ligne libre</SelectItem>
                        {produits.map(p => (
                          <SelectItem key={p.id} value={p.id}>[{p.ref}] — {p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Input placeholder="Désignation" value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} className="text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qté" value={l.qty} onChange={e => updateLigne(i, 'qty', Number(e.target.value))} className="text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Prix HT" value={l.subprice} onChange={e => updateLigne(i, 'subprice', Number(e.target.value))} className="text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="TVA%" value={l.tva_tx} onChange={e => updateLigne(i, 'tva_tx', Number(e.target.value))} className="text-xs" />
                      </div>
                      <div className="col-span-1">
                        {lignes.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLigne(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
        <StatCard title="Factures impayées" value={String(nonPayees.length)} subtitle={`${nonPayees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={AlertCircle} />
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
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedFacture(f)}>
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{f.ref}</td>
                  <td className="py-3 px-2 text-foreground">{f.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{formatDateFR(f.date)}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                  <td className="py-3 px-2"><StatusBadge statut={f.statut} /></td>
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
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Statut :</span>
                  <StatusBadge statut={selectedFacture.statut} />
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {selectedFacture.fk_statut === 0 && (
                    <>
                      <Button
                        onClick={() => validateFactureMutation.mutate(selectedFacture.id, { onSuccess: () => setSelectedFacture(null) })}
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

                  {/* Payment button for validated unpaid invoices */}
                  {selectedFacture.fk_statut >= 1 && !selectedFacture.paye && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setPaymentAmount(selectedFacture.montantTTC);
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
                    onClick={async () => {
                      try {
                        const url = await generatePDF('facture', selectedFacture.id, selectedFacture.ref, 'crabe');
                        if (url) { openPDFInNewTab(url, `${selectedFacture.ref}.pdf`); toast.success('PDF téléchargé'); }
                        else toast.error('PDF non disponible');
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
                        setEmailObjet(`Facture ${selectedFacture.ref}`);
                        setEmailMessage('');
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les lignes (Brouillon)</DialogTitle>
            <DialogDescription className="sr-only">Modification des lignes de facture</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Lignes</h3>
              <Button variant="outline" size="sm" onClick={() => setEditLines([...editLines, emptyLigne()])} className="gap-1"><Plus className="h-3 w-3" /> Ajouter</Button>
            </div>
            {editLines.map((l, i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input placeholder="Désignation" value={l.desc} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], desc: e.target.value }; setEditLines(u); }} className="text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qté" value={l.qty} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], qty: Number(e.target.value) }; setEditLines(u); }} className="text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Prix HT" value={l.subprice} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], subprice: Number(e.target.value) }; setEditLines(u); }} className="text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="TVA%" value={l.tva_tx} onChange={e => { const u = [...editLines]; u[i] = { ...u[i], tva_tx: Number(e.target.value) }; setEditLines(u); }} className="text-xs" />
                  </div>
                  <div className="col-span-1">
                    {editLines.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditLines(editLines.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={handleSaveEditLines} disabled={updateLinesMutation.isPending} className="w-full">
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
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destinataire</label>
              <Input value={emailDest} onChange={e => setEmailDest(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Objet</label>
              <Input value={emailObjet} onChange={e => setEmailObjet(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Message</label>
              <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="min-h-[120px]" />
            </div>
            <Button
              onClick={async () => {
                if (!selectedFacture || !emailDest) return;
                setSendingEmail(true);
                try {
                  await generatePDF('facture', selectedFacture.id, selectedFacture.ref, 'crabe');
                  await sendFactureByEmail(selectedFacture.id, emailDest, emailObjet, emailMessage);
                  toast.success('Facture envoyée par email via Dolibarr');
                } catch (e: any) {
                  toast.error(`Erreur envoi : ${e.message || e}`);
                }
                setSendingEmail(false);
                setEmailOpen(false);
              }}
              disabled={sendingEmail || !emailDest}
              className="w-full"
            >
              {sendingEmail ? 'Envoi via Dolibarr...' : 'Envoyer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
