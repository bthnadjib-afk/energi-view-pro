import { useState, useMemo } from 'react';
import { Euro, CheckCircle, AlertCircle, Plus, Trash2, FileCheck, FileDown, Send } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures, useClients, useProduits, useCreateFacture, useDeleteFacture, useValidateFacture } from '@/hooks/useDolibarr';
import { formatDateFR, generatePDF, openPDFInNewTab, downloadPDFUrl, sendFactureByEmail } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
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
        updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: 20, product_type: p.type === 'main_oeuvre' ? 1 : 0 };
      }
    }
    setLignes(updated);
  };

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    const updated = [...lignes];
    (updated[i] as any)[field] = value;
    setLignes(updated);
  };

  // Totals with TVA (factures include TVA)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Factures</h1>
          <p className="text-muted-foreground text-sm">Gestion des factures clients — TVA appliquée ici</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Créer une facture
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Nouvelle facture (avec TVA)</DialogTitle></DialogHeader>
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
                        <SelectValue placeholder="Sélectionner un article" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__libre__">✏️ Ligne libre</SelectItem>
                        {produits.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            [{p.ref}] — {p.label} ({p.type === 'main_oeuvre' ? "Main d'œuvre" : 'Fourniture'})
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
                          <SelectItem value="0">Fourniture</SelectItem>
                          <SelectItem value="1">Main d'œuvre</SelectItem>
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

              {/* Totals with TVA */}
              <div className="rounded-lg bg-accent/20 border border-border/30 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="text-foreground font-medium">{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA</span>
                  <span className="text-foreground">{totals.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border/30 pt-1">
                  <span className="text-foreground">Total TTC</span>
                  <span className="text-primary">{totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
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
        <StatCard title="Total CA TTC" value={`${totalCA.toLocaleString('fr-FR')} €`} icon={Euro} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
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
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => setSelectedFacture(f)}>
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{f.ref}</td>
                  <td className="py-3 px-2 text-foreground">{f.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{formatDateFR(f.date)}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                  <td className="py-3 px-2"><StatusBadge statut={f.statut} /></td>
                  <td className="py-3 px-2" onClick={e => e.stopPropagation()}>
                    {(f.statut === 'brouillon' || f.statut !== 'payée') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                            <AlertDialogDescription>La facture {f.ref} sera définitivement supprimée.</AlertDialogDescription>
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
        <DialogContent className="glass-strong border-border/50 max-w-lg">
          {selectedFacture && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">{selectedFacture.ref}</DialogTitle>
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
                  {selectedFacture.statut === 'brouillon' && (
                    <Button
                      onClick={() => validateFactureMutation.mutate(selectedFacture.id, { onSuccess: () => setSelectedFacture(null) })}
                      disabled={validateFactureMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
                    >
                      <FileCheck className="h-4 w-4" />
                      {validateFactureMutation.isPending ? 'Validation...' : 'Valider la facture'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-2 glass border-border/50"
                    onClick={async () => {
                      const url = await generatePDF('facture', selectedFacture.id, selectedFacture.ref, 'crabe');
                      if (url) { openPDFInNewTab(url, `${selectedFacture.ref}.pdf`); toast.success('PDF téléchargé'); }
                      else toast.error('Erreur PDF');
                    }}
                  >
                    <FileDown className="h-4 w-4" /> Voir le PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 glass border-border/50"
                    onClick={() => { setEmailDest(''); setEmailObjet(`Facture ${selectedFacture.ref}`); setEmailMessage(''); setEmailOpen(true); }}
                  >
                    <Send className="h-4 w-4" /> Envoyer par email
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Email dialog for factures */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="glass-strong border-border/50 max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Envoyer la facture par email</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destinataire</label>
              <Input value={emailDest} onChange={e => setEmailDest(e.target.value)} className="glass border-border/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Objet</label>
              <Input value={emailObjet} onChange={e => setEmailObjet(e.target.value)} className="glass border-border/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Message</label>
              <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="glass border-border/50 min-h-[120px]" />
            </div>
            <Button
              onClick={async () => {
                if (!selectedFacture || !emailDest) return;
                setSendingEmail(true);
                try {
                  await generatePDF('facture', selectedFacture.id, selectedFacture.ref, 'crabe');
                  await sendFactureByEmail(selectedFacture.id, emailDest, emailObjet, emailMessage);
                  await supabase.from('email_history').insert({
                    user_id: user?.id || '',
                    client_id: selectedFacture.socid || '',
                    document_ref: selectedFacture.ref,
                    destinataire: emailDest,
                    objet: emailObjet,
                    message: emailMessage,
                  });
                  toast.success('Facture envoyée par email');
                } catch {
                  toast.warning('Email enregistré localement — l\'envoi a échoué');
                }
                setSendingEmail(false);
                setEmailOpen(false);
              }}
              disabled={sendingEmail || !emailDest}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
            >
              {sendingEmail ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
