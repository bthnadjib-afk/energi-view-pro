import { useState, Fragment, useEffect, useMemo } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useDevis, useClients, useProduits, useCreateDevis, useConvertDevisToFacture, useCreateAcompte, useValidateDevis, useCloseDevis, useDeleteDevis } from '@/hooks/useDolibarr';
import { getAcompteBadge, formatDateFR, replaceEmailVariables, generatePDF, downloadPDFUrl, sendDevisByEmail, type Devis as DevisType } from '@/services/dolibarr';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowRightLeft, Receipt, CheckCircle2, XCircle, Send, FileCheck, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SignaturePad } from '@/components/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LigneForm {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type: number;
  productId: string;
  prixAchat: number;
}

function AcompteBadge({ montantHT }: { montantHT: number }) {
  const { label, variant } = getAcompteBadge(montantHT);
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

function DevisDetail({ devis, clients, onConvert, onAcompte, convertPending, acomptePending }: {
  devis: DevisType;
  clients: { id: string; nom: string; email: string }[];
  onConvert: () => void;
  onAcompte: () => void;
  convertPending: boolean;
  acomptePending: boolean;
}) {
  const validateMutation = useValidateDevis();
  const closeMutation = useCloseDevis();
  const deleteMutation = useDeleteDevis();
  const { user } = useAuth();

  const [showSignature, setShowSignature] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; nom: string; objet: string; corps: string }[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const client = clients.find(c => c.id === devis.socid);

  // Margin calculations
  const margeData = devis.lignes.map(l => {
    const venteHT = l.totalHT;
    const achatHT = (l.prixAchat || 0) * l.quantite;
    const margeBrute = venteHT - achatHT;
    const pctMarge = venteHT > 0 ? (margeBrute / venteHT) * 100 : 0;
    return { margeBrute, pctMarge };
  });
  const totalVenteHT = devis.lignes.reduce((s, l) => s + l.totalHT, 0);
  const totalAchatHT = devis.lignes.reduce((s, l) => s + (l.prixAchat || 0) * l.quantite, 0);
  const totalMarge = totalVenteHT - totalAchatHT;
  const totalPctMarge = totalVenteHT > 0 ? (totalMarge / totalVenteHT) * 100 : 0;

  useEffect(() => {
    if (emailOpen) {
      setEmailDest(client?.email || '');
      supabase.from('email_templates').select('*').then(({ data }) => {
        if (data) setEmailTemplates(data as any);
      });
    }
  }, [emailOpen, client]);

  const applyTemplate = (templateId: string) => {
    const tmpl = emailTemplates.find(t => t.id === templateId);
    if (!tmpl) return;
    const vars: Record<string, string> = {
      NOM_CLIENT: client?.nom || devis.client,
      REF_DEVIS: devis.ref,
      MONTANT_HT: `${devis.montantHT.toLocaleString('fr-FR')} €`,
      NOM_ENTREPRISE: 'Notre entreprise',
    };
    setEmailObjet(replaceEmailVariables(tmpl.objet, vars));
    setEmailMessage(replaceEmailVariables(tmpl.corps, vars));
  };

  const handleSendEmail = async () => {
    if (!emailDest || !emailObjet) return;
    setSendingEmail(true);
    try {
      // First generate PDF so Dolibarr can attach it
      await generatePDF('proposal', devis.id, devis.ref, 'azur');
      // Send via Dolibarr API
      await sendDevisByEmail(devis.id, emailDest, emailObjet, emailMessage);
      // Also log in local history
      await supabase.from('email_history').insert({
        user_id: user?.id || '',
        client_id: devis.socid || '',
        document_ref: devis.ref,
        destinataire: emailDest,
        objet: emailObjet,
        message: emailMessage,
      });
      toast.success('Devis envoyé par email via Dolibarr');
    } catch (e: any) {
      console.warn('Email send error:', e);
      // Fallback: at least save in history
      await supabase.from('email_history').insert({
        user_id: user?.id || '',
        client_id: devis.socid || '',
        document_ref: devis.ref,
        destinataire: emailDest,
        objet: emailObjet,
        message: emailMessage,
      });
      toast.warning('Email enregistré localement — l\'envoi Dolibarr a échoué');
    }
    setSendingEmail(false);
    setEmailOpen(false);
  };

  const handleAccepter = (signatureDataUrl: string) => {
    closeMutation.mutate({ id: devis.id, status: 2 }, {
      onSuccess: () => {
        toast.success('Devis accepté — Créer une facture d\'acompte ?', {
          action: { label: 'Créer acompte', onClick: onAcompte },
          duration: 8000,
        });
      }
    });
    setShowSignature(false);
  };

  const handleViewPDF = async () => {
    setGeneratingPDF(true);
    try {
      await generatePDF('proposal', devis.id, devis.ref, 'azur');
      const url = await downloadPDFUrl('proposal', devis.ref);
      if (url) {
        window.open(url, '_blank');
        toast.success(`PDF du devis ${devis.ref} ouvert`);
      } else {
        toast.success(`PDF du devis ${devis.ref} généré`);
      }
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    }
    setGeneratingPDF(false);
  };

  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-accent/20 p-4 mx-2 mb-2 rounded-lg space-y-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Détail des lignes (HT)</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-1 text-muted-foreground">Désignation</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Qté</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Prix Unit. HT</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Total HT</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Marge</th>
                <th className="text-right py-2 px-1 text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td className="py-2 px-1 text-foreground">{l.designation}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.quantite}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.prixUnitaire.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right font-medium text-foreground">{l.totalHT.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right text-emerald-400">{margeData[i].margeBrute.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right text-emerald-400">{margeData[i].pctMarge.toFixed(0)}%</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border/50 font-bold">
                <td colSpan={3} className="py-2 px-1 text-foreground">TOTAL</td>
                <td className="py-2 px-1 text-right text-foreground">{totalVenteHT.toLocaleString('fr-FR')} €</td>
                <td className="py-2 px-1 text-right text-emerald-400">{totalMarge.toLocaleString('fr-FR')} €</td>
                <td className="py-2 px-1 text-right text-emerald-400">{totalPctMarge.toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>

          {/* Status action buttons */}
          <div className="flex flex-wrap gap-3 pt-3 border-t border-border/30">
            {devis.statut === 'brouillon' && (
              <>
                <Button
                  onClick={() => validateMutation.mutate(devis.id)}
                  disabled={validateMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
                >
                  <FileCheck className="h-4 w-4" />
                  {validateMutation.isPending ? 'Validation...' : 'Valider le devis'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 glass border-red-500/30 text-red-400">
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                      <AlertDialogDescription>Le devis {devis.ref} sera définitivement supprimé.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(devis.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {devis.statut === 'en attente' && (
              <>
                <Button
                  onClick={() => setShowSignature(true)}
                  disabled={closeMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 border-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accepter (Signé)
                </Button>
                <Button
                  onClick={() => closeMutation.mutate({ id: devis.id, status: 3 })}
                  disabled={closeMutation.isPending}
                  variant="outline"
                  className="gap-2 glass border-red-500/30 text-red-400 hover:text-red-300"
                >
                  <XCircle className="h-4 w-4" />
                  Refuser
                </Button>
              </>
            )}

            {devis.statut === 'accepté' && (
              <>
                <Button onClick={onConvert} disabled={convertPending} className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 border-0">
                  <ArrowRightLeft className="h-4 w-4" />
                  {convertPending ? 'Conversion...' : 'Convertir en Facture'}
                </Button>
                <Button onClick={onAcompte} disabled={acomptePending} variant="outline" className="gap-2 glass border-border/50">
                  <Receipt className="h-4 w-4" />
                  {acomptePending ? 'Création...' : 'Saisir un acompte'}
                </Button>
              </>
            )}

            <Button onClick={handleViewPDF} disabled={generatingPDF} variant="outline" className="gap-2 glass border-border/50">
              <FileDown className="h-4 w-4" /> {generatingPDF ? 'Génération...' : 'Voir le PDF'}
            </Button>

            <Button onClick={() => setEmailOpen(true)} variant="outline" className="gap-2 glass border-border/50">
              <Send className="h-4 w-4" /> Envoyer par email
            </Button>
          </div>

          {/* Signature pad for acceptance */}
          {showSignature && (
            <div className="p-4 rounded-lg bg-accent/30 border border-border/30 space-y-3">
              <p className="text-sm font-medium text-foreground">Signature du client pour acceptation</p>
              <SignaturePad onSave={handleAccepter} />
              <Button variant="ghost" size="sm" onClick={() => setShowSignature(false)}>Annuler</Button>
            </div>
          )}

          {/* Email dialog */}
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogContent className="glass-strong border-border/50 max-w-lg">
              <DialogHeader><DialogTitle className="text-foreground">Envoyer par email</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Modèle</label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Choisir un modèle..." /></SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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
                <Button onClick={handleSendEmail} disabled={sendingEmail || !emailDest} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 border-0">
                  {sendingEmail ? 'Envoi...' : 'Envoyer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 0, product_type: 0, productId: '', prixAchat: 0 }]);

  const emptyLigne = (): LigneForm => ({ desc: '', qty: 1, subprice: 0, tva_tx: 0, product_type: 0, productId: '', prixAchat: 0 });
  const addLigne = () => setLignes([...lignes, emptyLigne()]);
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));

  const selectProduct = (i: number, productId: string) => {
    const updated = [...lignes];
    if (productId === '__libre__') {
      updated[i] = { ...updated[i], productId: '', desc: '' };
    } else {
      const p = produits.find(pr => pr.id === productId);
      if (p) {
        updated[i] = {
          ...updated[i],
          productId,
          desc: `[${p.ref}] ${p.label}`,
          subprice: p.prixHT,
          tva_tx: 0,
          product_type: p.type === 'main_oeuvre' ? 1 : 0,
          prixAchat: p.prixAchat || 0,
        };
      }
    }
    setLignes(updated);
  };

  const updateLigne = (i: number, field: keyof LigneForm, value: string | number) => {
    const updated = [...lignes];
    (updated[i] as any)[field] = value;
    setLignes(updated);
  };

  // Real-time totals (HT only, no TVA)
  const totals = useMemo(() => {
    const ht = lignes.reduce((s, l) => s + l.qty * l.subprice, 0);
    const achat = lignes.reduce((s, l) => s + l.qty * l.prixAchat, 0);
    const marge = ht - achat;
    const pctMarge = ht > 0 ? (marge / ht) * 100 : 0;
    return { ht, marge, pctMarge };
  }, [lignes]);

  const handleCreate = async () => {
    if (!socid || lignes.length === 0 || !lignes[0].desc) return;
    await createDevisMutation.mutateAsync({
      socid,
      lines: lignes.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: 0, product_type: l.product_type })),
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
          <p className="text-muted-foreground text-sm">Propositions commerciales HT — TVA sur facture finale uniquement</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Créer un devis
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Nouveau devis (HT)</DialogTitle></DialogHeader>
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
                      <div className="col-span-6">
                        <Input placeholder="Désignation" value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Qté" value={l.qty} onChange={e => updateLigne(i, 'qty', Number(e.target.value))} className="glass border-border/50 text-xs" />
                      </div>
                      <div className="col-span-3">
                        <Input type="number" placeholder="Prix HT" value={l.subprice} onChange={e => updateLigne(i, 'subprice', Number(e.target.value))} className="glass border-border/50 text-xs" />
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

              {/* Real-time totals HT */}
              <div className="rounded-lg bg-accent/20 border border-border/30 p-4 space-y-1">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">Total HT</span>
                  <span className="text-primary">{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">Marge brute</span>
                  <span className="text-emerald-400">{totals.marge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € ({totals.pctMarge.toFixed(0)}%)</span>
                </div>
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
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant HT</th>
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
                    <td className="py-3 px-2 text-right font-medium text-foreground">{(d.montantHT ?? 0).toLocaleString('fr-FR')} €</td>
                    <td className="py-3 px-2 hidden md:table-cell"><StatusBadge statut={d.statut} /></td>
                    <td className="py-3 px-2"><AcompteBadge montantHT={d.montantHT} /></td>
                  </tr>
                  {expandedId === d.id && (
                    <DevisDetail
                      devis={d}
                      clients={clients}
                      onConvert={() => convertMutation.mutate(d.id)}
                      onAcompte={() => acompteMutation.mutate({ socid: d.socid || '', montantHT: d.montantHT, devisRef: d.ref })}
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
