import { useState, Fragment, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/StatusBadge';
import {
  useDevis, useClients, useProduits, useCreateDevis, useConvertDevisToFacture,
  useCreateAcompte, useValidateDevis, useCloseDevis, useDeleteDevis,
  useUpdateDevisLines, useSetDevisToDraft, useCloneDevis, useUpdateDevisSocid,
  useReopenDevis, useCreateIntervention, useDolibarrUsers,
} from '@/hooks/useDolibarr';
import {
  getAcompteBadge, formatDateFR, replaceEmailVariables, DEVIS_STATUTS,
  saveDevisSignatureToken, markDevisSent, closeDevis, markDevisAutoExpired, type Devis as DevisType, type Client,
} from '@/services/dolibarr';
import { openDevisPdf, devisPdfToBase64, devisPdfToBlobUrl } from '@/services/devisPdf';
import { useConfig } from '@/hooks/useConfig';
import { useRecordDevisEnvoi, useDevisRelances, useMarkDevisRelance, getDevisRelanceStatus } from '@/hooks/useDevisRelances';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, Plus, Trash2, ArrowRightLeft, Receipt, CheckCircle2,
  XCircle, Send, FileCheck, FileDown, Pencil, Search, Filter, Zap, Copy,
  UserPen, Ban, Link2, Loader2, RotateCcw, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SignaturePad } from '@/components/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { persistLinesToCatalog } from '@/lib/catalogHelpers';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductGroups } from '@/hooks/useProductGroups';
import { Layers } from 'lucide-react';
import { HelpTooltip } from '@/components/HelpTooltip';

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

function AcompteBadge({ montantHT }: { montantHT: number }) {
  const { label, variant } = getAcompteBadge(montantHT);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      variant === 'green' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-orange-100 text-orange-700 border-orange-200'
    )}>{label}</span>
  );
}

function DevisDetail({ devis, clients, produits, onConvert, onAcompte, convertPending, acomptePending, onCollapse, relanceVariant, onMarkRelance }: {
  devis: DevisType;
  clients: Client[];
  produits: { id: string; ref: string; label: string; prixHT: number; tauxTVA: number; type: string; prixAchat?: number }[];
  onConvert: () => void;
  onAcompte: () => void;
  convertPending: boolean;
  acomptePending: boolean;
  onCollapse: () => void;
  relanceVariant?: 'a_relancer' | 'relance' | 'expire' | 'envoye' | 'signe' | 'none';
  onMarkRelance?: () => void;
}) {
  const validateMutation = useValidateDevis();
  const closeMutation = useCloseDevis();
  const deleteMutation = useDeleteDevis();
  const updateLinesMutation = useUpdateDevisLines();
  const setToDraftMutation = useSetDevisToDraft();
  const reopenMutation = useReopenDevis();
  const createInterventionMutation = useCreateIntervention();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const cloneMutation = useCloneDevis();
  const updateSocidMutation = useUpdateDevisSocid();
  const { config } = useConfig();
  const queryClient = useQueryClient();
  const recordEnvoi = useRecordDevisEnvoi();
  const { data: productGroups = [] } = useProductGroups();
  const [insertEditLotOpen, setInsertEditLotOpen] = useState(false);

  // Tracks if we're editing a previously-validated devis (so we re-validate after save)
  const [editingValidatedDevis, setEditingValidatedDevis] = useState(false);

  const [showSignature, setShowSignature] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; nom: string; objet: string; corps: string }[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLines, setEditLines] = useState<LigneForm[]>([]);
  const [changeClientOpen, setChangeClientOpen] = useState(false);
  const [newSocid, setNewSocid] = useState('');
  const [sigLinkCopied, setSigLinkCopied] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [acceptRefuseOpen, setAcceptRefuseOpen] = useState(false);
  const [createInterOpen, setCreateInterOpen] = useState(false);
  const [interDate, setInterDate] = useState('');
  const [interTechId, setInterTechId] = useState('');
  const [interHeureDebut, setInterHeureDebut] = useState('08:00');
  const [interHeureFin, setInterHeureFin] = useState('10:00');

  const client = clients.find(c => c.id === devis.socid);

  const margeData = devis.lignes.map(l => {
    const venteHT = l.totalHT;
    const achatHT = (l.prixAchat || 0) * l.quantite;
    const margeBrute = venteHT - achatHT;
    return { margeBrute, pctMarge: venteHT > 0 ? (margeBrute / venteHT) * 100 : 0 };
  });
  const totalVenteHT = devis.lignes.reduce((s, l) => s + l.totalHT, 0);
  const totalAchatHT = devis.lignes.reduce((s, l) => s + (l.prixAchat || 0) * l.quantite, 0);
  const totalMarge = totalVenteHT - totalAchatHT;
  const totalPctMarge = totalVenteHT > 0 ? (totalMarge / totalVenteHT) * 100 : 0;

  const isExpired = devis.finValidite && new Date(devis.finValidite) < new Date() && devis.fk_statut <= 1;
  const isDraft = devis.fk_statut === 0;
  const isValidated = devis.fk_statut === 1 && !devis.sent;  // Validé mais pas encore envoyé
  const isSent = devis.fk_statut === 1 && devis.sent === true; // Envoyé par email
  const isSigned = devis.fk_statut === 2;   // Accepté
  const isRefused = devis.fk_statut === 3;
  const isInvoiced = devis.fk_statut === 4;

  // Fetch the public online-signature URL from the backend (it computes the
  // securekey hash required by the public sign page — without it the link 404s).
  const [signUrl, setSignUrl] = useState<string>('');
  useEffect(() => {
    if (!devis.ref) return;
    let cancelled = false;
    supabase.functions.invoke('get-signature-url', { body: { ref: devis.ref, source: 'proposal' } })
      .then(({ data }) => {
        if (!cancelled && data?.ok && data.url) setSignUrl(data.url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [devis.ref]);

  useEffect(() => {
    if (emailOpen) {
      setEmailDest(client?.email || '');
      setEmailObjet(`Électricien du Genevois - Devis ${devis.ref}`);
      const signLine = signUrl
        ? `\n\n👉 Pour accepter et signer ce devis en ligne, cliquez ici :\n${signUrl}\n`
        : '';
      setEmailMessage(`Bonjour,\n\nVous trouverez ci-joint votre devis ${devis.ref} d'un montant de ${devis.montantTTC.toLocaleString('fr-FR')} € TTC.${signLine}\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\nÉlectricien du Genevois`);
      supabase.from('email_templates').select('*').then(({ data }) => {
        if (data) setEmailTemplates(data as any);
      });
    }
  }, [emailOpen, client, devis.ref, devis.montantTTC, signUrl]);

  const applyTemplate = (templateId: string) => {
    const tmpl = emailTemplates.find(t => t.id === templateId);
    if (!tmpl) return;
    const vars: Record<string, string> = {
      NOM_CLIENT: client?.nom || devis.client,
      REF_DEVIS: devis.ref,
      MONTANT_HT: `${devis.montantHT.toLocaleString('fr-FR')} €`,
      MONTANT_TTC: `${devis.montantTTC.toLocaleString('fr-FR')} €`,
      NOM_ENTREPRISE: config.entreprise.nom || 'Notre entreprise',
    };
    setEmailObjet(replaceEmailVariables(tmpl.objet, vars));
    setEmailMessage(replaceEmailVariables(tmpl.corps, vars));
  };

  const handleSendEmail = async () => {
    if (!emailDest) return;
    if (!config.smtp.user || !config.smtp.pass) {
      toast.error('SMTP non configuré — allez dans Configuration → Serveur mail');
      return;
    }
    setSendingEmail(true);
    try {
      const pdfBase64 = devisPdfToBase64({ devis, client: client as Client | undefined, entreprise: config.entreprise });
      const { data, error } = await supabase.functions.invoke('send-email-smtp', {
        body: {
          to: emailDest,
          subject: emailObjet || `Devis ${devis.ref}`,
          message: emailMessage,
          pdfBase64,
          pdfFilename: `${devis.ref}.pdf`,
          smtpHost: config.smtp.host,
          smtpPort: config.smtp.port || '465',
          smtpUser: config.smtp.user,
          smtpPass: config.smtp.pass,
        },
      });
      if (error) throw new Error(error.message);
      if (data && !data.ok) throw new Error(data.error || 'Erreur SMTP');
      toast.success(`Devis ${devis.ref} envoyé à ${emailDest}`);
      setEmailOpen(false);
      // Marquer le devis comme "Envoyé" dans Dolibarr (note_private) + refresh
      try {
        await markDevisSent(devis.id, devis.note_private);
        queryClient.invalidateQueries({ queryKey: ['devis'] });
      } catch { /* non-bloquant */ }
      // Tracker l'envoi pour le système de relance (validité 30j, à relancer après 7j)
      try {
        await recordEnvoi.mutateAsync({
          devis_id: devis.id,
          devis_ref: devis.ref,
          client_email: emailDest,
          date_fin_validite: devis.finValidite || null,
        });
      } catch { /* non-bloquant */ }
    } catch (e: any) {
      toast.error(`Erreur envoi : ${e.message || e}`);
    }
    setSendingEmail(false);
  };

  const handleValidate = async () => {
    try {
      await validateMutation.mutateAsync(devis.id);
    } catch (e: any) {
      console.error('Validate devis error:', e);
      toast.error(`Erreur validation : ${e.message || JSON.stringify(e)}`);
    }
  };

  const handleAccepterSansSignature = async () => {
    try {
      await closeMutation.mutateAsync({ id: devis.id, status: 2 });
      toast.success('Devis accepté manuellement', {
        action: { label: 'Créer acompte', onClick: onAcompte },
        duration: 8000,
      });
    } catch (e: any) {
      console.error('Accept devis error:', e);
      toast.error(`Erreur acceptation : ${e?.message || JSON.stringify(e)}`);
    }
  };

  const handleAccepterAvecSignature = async (_sig: string) => {
    try {
      await closeMutation.mutateAsync({ id: devis.id, status: 2 });
      toast.success('Devis signé', {
        action: { label: 'Créer acompte', onClick: onAcompte },
        duration: 8000,
      });
      setShowSignature(false);
    } catch (e: any) {
      console.error('Sign devis error:', e);
      toast.error(`Erreur signature : ${e?.message || JSON.stringify(e)}`);
    }
  };

  const handleRefuser = async () => {
    try {
      await closeMutation.mutateAsync({ id: devis.id, status: 3 });
    } catch {}
  };

  // "Annuler" un devis = le fermer comme abandonné dans Dolibarr (status 3 = non signé/abandonné).
  // Pour un brouillon, on supprime car il n'y a rien à fermer.
  const handleAnnuler = async () => {
    try {
      if (isDraft) {
        await deleteMutation.mutateAsync(devis.id);
      } else {
        await closeMutation.mutateAsync({ id: devis.id, status: 3 });
      }
      onCollapse();
    } catch {}
  };

  const handleClone = async () => {
    try {
      await cloneMutation.mutateAsync({ id: devis.id });
    } catch {}
  };

  const handleChangeClient = async () => {
    if (!newSocid || newSocid === devis.socid) return;
    try {
      await updateSocidMutation.mutateAsync({ id: devis.id, socid: newSocid });
      setChangeClientOpen(false);
      setNewSocid('');
    } catch {}
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync(devis.id);
    } catch {}
  };

  const openCreateIntervention = () => {
    const today = new Date();
    setInterDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setInterTechId('');
    setInterHeureDebut('08:00');
    setInterHeureFin('10:00');
    setCreateInterOpen(true);
  };

  const handleCreateIntervention = async () => {
    if (!devis.socid || !interDate) {
      toast.error('Date requise');
      return;
    }
    try {
      await createInterventionMutation.mutateAsync({
        socid: devis.socid,
        description: `Chantier issu du devis ${devis.ref}`,
        date: interDate,
        heureDebut: interHeureDebut,
        heureFin: interHeureFin,
        fk_user_assign: interTechId || undefined,
        type: 'chantier',
        note_private: `Devis source : ${devis.ref}`,
      });
      setCreateInterOpen(false);
      toast.success('Intervention "Chantier" créée depuis le devis');
    } catch (e: any) {
      toast.error(`Erreur création intervention : ${e?.message || e}`);
    }
  };

  const handleGenerateSignatureLink = async () => {
    try {
      const token = crypto.randomUUID();
      await saveDevisSignatureToken(devis.id, devis.ref, token);
      const url = `${window.location.origin}/signature-devis/${devis.id}?token=${token}`;
      await navigator.clipboard.writeText(url);
      setSigLinkCopied(true);
      toast.success('Lien de signature copié dans le presse-papier', {
        description: 'Envoyez ce lien au client pour qu\'il puisse signer en ligne.',
      });
      setTimeout(() => setSigLinkCopied(false), 3000);
    } catch (e: any) {
      toast.error(`Erreur : ${e.message || e}`);
    }
  };

  const handleViewPDF = () => {
    setGeneratingPDF(true);
    try {
      const url = devisPdfToBlobUrl({ devis, client: client as Client | undefined, entreprise: config.entreprise });
      setPdfPreviewUrl(url);
      setPdfPreviewOpen(true);
    } catch (e: any) {
      toast.error(`Erreur PDF : ${e.message || e}`);
    }
    setGeneratingPDF(false);
  };

  const openEditLines = () => {
    setEditLines(devis.lignes.map(l => ({
      desc: l.designation,
      qty: l.quantite,
      subprice: l.prixUnitaire,
      tva_tx: 20,
      product_type: 0,
      productId: '',
      prixAchat: l.prixAchat || 0,
    })));
    setEditOpen(true);
  };

  const handleSaveLines = async () => {
    if (!devis.socid) return;
    const zeroLines = editLines.filter(l => l.qty <= 0);
    if (zeroLines.length > 0) {
      toast.error(`${zeroLines.length} ligne${zeroLines.length > 1 ? 's ont' : ' a'} une quantité à 0 — corrigez avant d'enregistrer`);
      return;
    }
    try {
      await updateLinesMutation.mutateAsync({
        id: devis.id,
        socid: devis.socid,
        lines: editLines.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx || 20, product_type: l.product_type, pa_ht: l.prixAchat })),
      });
      // Persist new "free" lines into the catalog if requested
      try {
        const created = await persistLinesToCatalog(editLines, produits as any);
        if (created > 0) {
          toast.success(`${created} article(s) ajouté(s) au catalogue`);
          queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
      } catch {}
      // If we were editing a previously validated devis, re-validate so it
      // returns to "Open" in Dolibarr / "Validé" in the app — never stays in draft.
      if (editingValidatedDevis) {
        try {
          await validateMutation.mutateAsync(devis.id);
        } catch (e: any) {
          toast.error(`Erreur revalidation : ${e?.message || e}`);
        }
        setEditingValidatedDevis(false);
      }
      setEditOpen(false);
    } catch {}
  };

  const emptyLigne = (): LigneForm => ({ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '', prixAchat: 0 });

  const insertEditLot = (groupId: string) => {
    const group = productGroups.find(g => g.id === groupId);
    if (!group) return;
    const newLines: LigneForm[] = group.lines.map(l => ({
      desc: l.desc, qty: l.variable_qty ? 0 : l.qty,
      subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type,
      prixAchat: l.prixAchat, productId: '',
    }));
    setEditLines(prev => [...prev, ...newLines]);
    setInsertEditLotOpen(false);
    const nbVar = group.lines.filter(l => l.variable_qty).length;
    if (nbVar > 0) toast.info(`${nbVar} ligne${nbVar > 1 ? 's' : ''} avec quantité à définir`);
    else toast.success(`Lot "${group.nom}" inséré`);
  };

  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="bg-muted/50 p-4 mx-2 mb-2 rounded-lg space-y-4 border border-border">
          {isExpired && (
            <div className="bg-red-100 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs font-medium">
              ⚠️ Ce devis est expiré (fin de validité : {formatDateFR(devis.finValidite)})
            </div>
          )}

          {/* Lignes */}
          <p className="text-xs font-medium text-muted-foreground mb-2">Détail des lignes (HT)</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
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
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-1 text-foreground">{l.designation}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.quantite}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.prixUnitaire.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right font-medium text-foreground">{l.totalHT.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right text-emerald-600">{margeData[i].margeBrute.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right text-emerald-600">{margeData[i].pctMarge.toFixed(0)}%</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-bold">
                <td colSpan={3} className="py-2 px-1 text-foreground">TOTAL</td>
                <td className="py-2 px-1 text-right text-foreground">{totalVenteHT.toLocaleString('fr-FR')} €</td>
                <td className="py-2 px-1 text-right text-emerald-600">{totalMarge.toLocaleString('fr-FR')} €</td>
                <td className="py-2 px-1 text-right text-emerald-600">{totalPctMarge.toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>

          {/* ── Actions selon statut ── */}
          <div className="space-y-3 pt-3 border-t border-border">

            {/* BROUILLON */}
            {isDraft && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-muted-foreground self-center mr-1">Brouillon :</span>
                <Button onClick={openEditLines} variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Modifier les lignes
                </Button>
                <Button
                  onClick={handleValidate}
                  disabled={validateMutation.isPending}
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  {validateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                  {validateMutation.isPending ? 'Validation...' : 'Valider le devis'}
                </Button>
                <Button onClick={() => { setNewSocid(devis.socid || ''); setChangeClientOpen(true); }} size="sm" variant="outline" className="gap-1.5">
                  <UserPen className="h-3.5 w-3.5" /> Changer client
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10">
                      <Ban className="h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer {devis.ref} ?</AlertDialogTitle>
                      <AlertDialogDescription>Ce devis sera supprimé définitivement.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Retour</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnnuler} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* VALIDÉ (envoyé en attente de réponse client) */}
            {(isValidated || isSent) && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-muted-foreground self-center mr-1">{isSent ? 'Envoyé :' : 'Validé :'}</span>
                <Button
                  onClick={() => setEmailOpen(true)}
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-3.5 w-3.5" /> {isSent ? 'Renvoyer par email' : 'Envoyer par email'}
                </Button>
                <Button
                  onClick={() => setAcceptRefuseOpen(true)}
                  disabled={closeMutation.isPending}
                  size="sm"
                  className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Accepter / Refuser
                </Button>
                {relanceVariant === 'a_relancer' && onMarkRelance && (
                  <Button
                    onClick={onMarkRelance}
                    size="sm"
                    className="gap-1.5 bg-orange-500 hover:bg-orange-600"
                  >
                    <Send className="h-3.5 w-3.5" /> Marquer relancé
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    // Edit a validated devis: temporarily set to draft, open editor.
                    // After save, handleSaveLines will re-validate so it stays "Validé".
                    setEditingValidatedDevis(true);
                    try {
                      await setToDraftMutation.mutateAsync(devis.id);
                      openEditLines();
                    } catch (e: any) {
                      setEditingValidatedDevis(false);
                      toast.error(`Erreur : ${e?.message || e}`);
                    }
                  }}
                  disabled={setToDraftMutation.isPending || updateLinesMutation.isPending || validateMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier les lignes
                </Button>
                <Button
                  onClick={handleConvert}
                  disabled={convertPending}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Classer facturé (brouillon)
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10">
                      <Ban className="h-3.5 w-3.5" /> Annuler
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annuler le devis {devis.ref} ?</AlertDialogTitle>
                      <AlertDialogDescription>Le devis sera marqué comme abandonné (statut "Non signé"). Il ne sera pas supprimé.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Retour</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnnuler} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Annuler le devis</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* ACCEPTÉ */}
            {isSigned && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-emerald-600 self-center mr-1">Accepté :</span>
                <Button onClick={openCreateIntervention} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Wrench className="h-3.5 w-3.5" /> Créer intervention
                </Button>
                <Button onClick={handleConvert} disabled={convertPending} size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Classer facturé (brouillon)
                </Button>
                <Button onClick={onAcompte} disabled={acomptePending} size="sm" variant="outline" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Saisir un acompte
                </Button>
                <Button onClick={handleClone} disabled={cloneMutation.isPending} size="sm" variant="outline" className="gap-1.5">
                  {cloneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Cloner
                </Button>
                <Button onClick={handleReopen} disabled={reopenMutation.isPending} size="sm" variant="outline" className="gap-1.5">
                  {reopenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Rouvrir
                </Button>
              </div>
            )}

            {/* REFUSÉ */}
            {isRefused && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-red-600 self-center mr-1">Refusé / Annulé :</span>
                <Button onClick={handleReopen} disabled={reopenMutation.isPending} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  {reopenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Rouvrir
                </Button>
                <Button onClick={handleClone} disabled={cloneMutation.isPending} size="sm" variant="outline" className="gap-1.5">
                  {cloneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Cloner
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10">
                      <Ban className="h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer {devis.ref} ?</AlertDialogTitle>
                      <AlertDialogDescription>Le devis sera repassé en brouillon puis supprimé définitivement.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Retour</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnnuler} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* FACTURÉ */}
            {isInvoiced && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-violet-600 self-center mr-1">Facturé :</span>
                <Button onClick={handleReopen} disabled={reopenMutation.isPending} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  {reopenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Rouvrir
                </Button>
                <Button onClick={handleClone} disabled={cloneMutation.isPending} size="sm" variant="outline" className="gap-1.5">
                  {cloneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Cloner
                </Button>
              </div>
            )}

            {/* Toujours disponibles : PDF + Lien Dolibarr + Clone (hors Facturé) */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handleViewPDF} disabled={generatingPDF} size="sm" variant="outline" className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> {generatingPDF ? 'PDF...' : 'Voir PDF'}
              </Button>
              {!isDraft && !isInvoiced && signUrl && (
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(signUrl);
                      setSigLinkCopied(true);
                      toast.success('Lien de signature copié', { description: 'Envoyez ce lien au client pour qu\'il puisse signer en ligne.' });
                      setTimeout(() => setSigLinkCopied(false), 3000);
                    } catch (e: any) {
                      toast.error(`Erreur : ${e?.message || e}`);
                    }
                  }}
                  size="sm"
                  variant="outline"
                  className={cn('gap-1.5', sigLinkCopied && 'border-green-400 text-green-700')}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {sigLinkCopied ? 'Lien copié !' : 'Lien signature en ligne'}
                </Button>
              )}
              {!isInvoiced && (
                <Button onClick={handleClone} disabled={cloneMutation.isPending || isSigned || isRefused} size="sm" variant="outline" className={cn('gap-1.5', (isSigned || isRefused) && 'hidden')}>
                  {cloneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Cloner
                </Button>
              )}
            </div>
          </div>

          {/* Pad signature */}
          {showSignature && (
            <div className="p-4 rounded-lg bg-muted border border-border space-y-3">
              <p className="text-sm font-medium text-foreground">Signature du client pour acceptation</p>
              <SignaturePad onSave={handleAccepterAvecSignature} />
              <Button variant="ghost" size="sm" onClick={() => setShowSignature(false)}>Annuler</Button>
            </div>
          )}

          {/* Dialog email */}
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Envoyer {devis.ref} par email</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {!config.smtp.user && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                    ⚠️ SMTP non configuré — <strong>Configuration → Serveur mail</strong>
                  </div>
                )}
                {emailTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Modèle</label>
                    <Select onValueChange={applyTemplate}>
                      <SelectTrigger><SelectValue placeholder="Choisir un modèle..." /></SelectTrigger>
                      <SelectContent>
                        {emailTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Destinataire *</label>
                  <Input value={emailDest} onChange={e => setEmailDest(e.target.value)} type="email" placeholder="client@exemple.fr" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Objet</label>
                  <Input value={emailObjet} onChange={e => setEmailObjet(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Message</label>
                  <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="min-h-[160px]" placeholder="Bonjour, veuillez trouver ci-joint votre devis..." />
                </div>
                {signUrl && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Link2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Lien de signature en ligne inclus dans le message</p>
                        <p className="text-blue-700 truncate" title={signUrl}>{signUrl}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(signUrl);
                          toast.success('Lien copié');
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copier
                      </Button>
                    </div>
                  </div>
                )}
                <Button onClick={handleSendEmail} disabled={sendingEmail || !emailDest} className="w-full gap-2">
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingEmail ? 'Envoi en cours...' : 'Envoyer avec le PDF'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog aperçu PDF */}
          <Dialog open={pdfPreviewOpen} onOpenChange={(open) => {
            setPdfPreviewOpen(open);
            if (!open && pdfPreviewUrl) {
              URL.revokeObjectURL(pdfPreviewUrl);
              setPdfPreviewUrl(null);
            }
          }}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Aperçu du devis {devis.ref}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0">
                {pdfPreviewUrl ? (
                  <iframe src={pdfPreviewUrl} className="w-full h-full rounded-md border border-border" title={`Devis ${devis.ref}`} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">Chargement...</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => pdfPreviewUrl && window.open(pdfPreviewUrl, '_blank')}>
                  Ouvrir dans un nouvel onglet
                </Button>
                <Button onClick={() => {
                  const a = document.createElement('a');
                  a.href = pdfPreviewUrl || '';
                  a.download = `${devis.ref}.pdf`;
                  a.click();
                }}>
                  Télécharger
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={changeClientOpen} onOpenChange={setChangeClientOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Changer le client — {devis.ref}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Client actuel : <strong>{devis.client}</strong></p>
                  <Select value={newSocid} onValueChange={setNewSocid}>
                    <SelectTrigger><SelectValue placeholder="Nouveau client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setChangeClientOpen(false)}>Annuler</Button>
                  <Button onClick={handleChangeClient} disabled={!newSocid || newSocid === devis.socid || updateSocidMutation.isPending}>
                    {updateSocidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Enregistrer
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog Accepter / Refuser */}
          <Dialog open={acceptRefuseOpen} onOpenChange={setAcceptRefuseOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Réponse client — {devis.ref}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">Choisissez la décision du client pour ce devis :</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={async () => { setAcceptRefuseOpen(false); await handleAccepterSansSignature(); }}
                    disabled={closeMutation.isPending}
                    className="h-16 flex-col gap-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-xs font-semibold">Accepté</span>
                  </Button>
                  <Button
                    onClick={async () => { setAcceptRefuseOpen(false); await handleRefuser(); }}
                    disabled={closeMutation.isPending}
                    variant="outline"
                    className="h-16 flex-col gap-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="text-xs font-semibold">Refusé</span>
                  </Button>
                </div>
                <Button
                  onClick={() => { setAcceptRefuseOpen(false); setShowSignature(true); }}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Accepté avec signature (pad)
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setAcceptRefuseOpen(false)}>
                  Annuler
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog créer intervention depuis devis accepté */}
          <Dialog open={createInterOpen} onOpenChange={setCreateInterOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Créer un chantier — {devis.ref}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Une intervention de type <strong>Chantier</strong> sera créée pour <strong>{devis.client}</strong>.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Date *</label>
                  <Input type="date" value={interDate} onChange={e => setInterDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Heure début</label>
                    <Input type="time" value={interHeureDebut} onChange={e => setInterHeureDebut(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Heure fin</label>
                    <Input type="time" value={interHeureFin} onChange={e => setInterHeureFin(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Technicien</label>
                  <Select value={interTechId} onValueChange={setInterTechId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un technicien (optionnel)" /></SelectTrigger>
                    <SelectContent>
                      {dolibarrUsers.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.firstname || ''} {u.lastname || u.login}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCreateInterOpen(false)}>Annuler</Button>
                  <Button onClick={handleCreateIntervention} disabled={createInterventionMutation.isPending || !interDate} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    {createInterventionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                    Créer le chantier
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Modifier les lignes — {devis.ref}</DialogTitle></DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Lignes du devis</h3>
                    <div className="flex gap-2">
                      {productGroups.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setInsertEditLotOpen(true)} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                          <Layers className="h-3.5 w-3.5" /> Insérer un lot
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditLines([...editLines, emptyLigne()])} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                      </Button>
                    </div>
                  </div>
                  {editLines.map((l, i) => {
                    const ligneHT = l.qty * l.subprice;
                    const ligneAchat = l.qty * l.prixAchat;
                    const ligneMarge = ligneHT - ligneAchat;
                    const lignePct = ligneHT > 0 ? (ligneMarge / ligneHT) * 100 : 0;
                    const hasZeroQty = l.qty <= 0;
                    return (
                      <div key={i} className={cn('p-4 rounded-lg border space-y-3', hasZeroQty ? 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700' : 'bg-muted/40 border-border')}>
                        <div className="flex items-center justify-between">
                          <span className={cn('text-xs font-semibold uppercase tracking-wide', hasZeroQty ? 'text-red-600' : 'text-muted-foreground')}>
                            Ligne {i + 1}{hasZeroQty && ' — Quantité requise'}
                          </span>
                          {editLines.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setEditLines(editLines.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3.5 w-3.5" /> Supprimer
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Article du catalogue (optionnel)</label>
                          <Select value={l.productId || '__libre__'} onValueChange={(v) => {
                            const updated = [...editLines];
                            if (v === '__libre__') {
                              updated[i] = { ...updated[i], productId: '', desc: '' };
                            } else {
                              const p = produits.find(pr => pr.id === v);
                              if (p) updated[i] = { ...updated[i], productId: v, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA || 20, product_type: p.type === 'main_oeuvre' ? 1 : 0, prixAchat: p.prixAchat || 0 };
                            }
                            setEditLines(updated);
                          }}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Choisir un article..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__libre__">✏️ Ligne libre (saisie manuelle)</SelectItem>
                              {produits.map(p => <SelectItem key={p.id} value={p.id}>[{p.ref}] {p.label} — {p.prixHT.toLocaleString('fr-FR')} € HT ({p.type === 'main_oeuvre' ? "Main d'œuvre" : 'Fourniture'})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Désignation *</label>
                          <Input placeholder="Description de la prestation ou fourniture..." value={l.desc} onChange={e => { const u = [...editLines]; u[i].desc = e.target.value; setEditLines(u); }} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Quantité</label>
                            <Input type="number" min="0" step="0.01" value={l.qty} onChange={e => { const u = [...editLines]; u[i].qty = Number(e.target.value); setEditLines(u); }} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Prix unitaire HT (€)</label>
                            <Input type="number" min="0" step="0.01" value={l.subprice} onChange={e => { const u = [...editLines]; u[i].subprice = Number(e.target.value); setEditLines(u); }} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Prix achat HT (€)</label>
                            <Input type="number" min="0" step="0.01" value={l.prixAchat} onChange={e => { const u = [...editLines]; u[i].prixAchat = Number(e.target.value); setEditLines(u); }} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Total HT</label>
                            <div className="h-10 flex items-center px-3 rounded-md bg-background border border-border text-sm font-semibold text-foreground">
                              {ligneHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </div>
                          </div>
                        </div>

                        {l.prixAchat > 0 && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">Marge ligne :</span>
                            <span className={cn('font-semibold', ligneMarge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                              {ligneMarge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € ({lignePct.toFixed(1)}%)
                            </span>
                          </div>
                        )}

                        {/* Type + Sauver dans catalogue (uniquement pour les lignes libres) */}
                        {!l.productId && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Type :</label>
                              <Select value={String(l.product_type)} onValueChange={(v) => { const u = [...editLines]; u[i].product_type = Number(v); setEditLines(u); }}>
                                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">🔧 Main d'œuvre</SelectItem>
                                  <SelectItem value="0">📦 Fourniture</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                              <Checkbox checked={!!l.saveToCatalog} onCheckedChange={(v) => { const u = [...editLines]; u[i].saveToCatalog = !!v; setEditLines(u); }} />
                              <span>Ajouter au catalogue</span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const ht = editLines.reduce((s, l) => s + l.qty * l.subprice, 0);
                  const achat = editLines.reduce((s, l) => s + l.qty * l.prixAchat, 0);
                  const marge = ht - achat;
                  const pct = ht > 0 ? (marge / ht) * 100 : 0;
                  return (
                    <div className="rounded-lg bg-muted/50 border border-border p-4 grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                        <p className="text-lg font-bold text-foreground">{ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                      </div>
                      <div className="text-center border-x border-border">
                        <p className="text-xs text-muted-foreground mb-1">Total TTC (20%)</p>
                        <p className="text-lg font-bold text-foreground">{(ht * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Marge brute</p>
                        <p className={cn('text-lg font-bold', marge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {marge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € <span className="text-sm">({pct.toFixed(1)}%)</span>
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {editLines.some(l => l.qty <= 0) && (
                  <p className="text-sm text-red-600 font-medium text-center">
                    Corrigez les lignes avec quantité 0 avant d'enregistrer
                  </p>
                )}
                <Button onClick={handleSaveLines} disabled={updateLinesMutation.isPending || editLines.some(l => l.qty <= 0)} className="w-full h-12 text-base">
                  {updateLinesMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog — Insérer un lot (modification) */}
          <Dialog open={insertEditLotOpen} onOpenChange={setInsertEditLotOpen}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Insérer un lot</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {productGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => insertEditLot(g.id)}
                    className="w-full text-left rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 p-4 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{g.nom}</span>
                      <span className="text-xs text-muted-foreground">{g.lines.length} ligne{g.lines.length > 1 ? 's' : ''}</span>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.lines.map((l, i) => (
                        <span key={i} className={cn(
                          'text-[11px] px-2 py-0.5 rounded-full border',
                          l.variable_qty
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-border bg-muted text-muted-foreground'
                        )}>
                          {l.variable_qty ? '⚠ ' : ''}{l.desc.length > 28 ? l.desc.slice(0, 28) + '…' : l.desc}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </td>
    </tr>
  );

  function handleConvert() { onConvert(); }
}

export default function Devis() {
  const queryClient = useQueryClient();
  const { data: devis = [] } = useDevis();
  const { data: clients = [] } = useClients();
  const { data: produits = [] } = useProduits();
  const { data: productGroups = [] } = useProductGroups();
  const { data: devisRelances = [] } = useDevisRelances();
  const markRelanceMutation = useMarkDevisRelance();
  const devisRelanceMap = useMemo(() => {
    const m = new Map<string, typeof devisRelances[0]>();
    devisRelances.forEach(r => m.set(r.devis_id, r));
    return m;
  }, [devisRelances]);

  // Auto-expiry : ferme automatiquement les devis validés dont la date de fin de validité est dépassée
  const autoClosedRef = useRef(new Set<string>());
  useEffect(() => {
    if (devis.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const toClose = devis.filter(d =>
      d.fk_statut === 1 &&
      d.finValidite &&
      d.finValidite < today &&
      !autoClosedRef.current.has(d.id)
    );
    if (toClose.length === 0) return;
    toClose.forEach(d => autoClosedRef.current.add(d.id));
    Promise.all(toClose.map(d =>
      closeDevis(d.id, 3).then(() => markDevisAutoExpired(d.id, d.note_private))
    ))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['devis'] });
        toast.info(
          `${toClose.length} devis expiré${toClose.length > 1 ? 's' : ''} automatiquement annulé${toClose.length > 1 ? 's' : ''}`,
          { description: toClose.map(d => d.ref).join(', ') }
        );
      })
      .catch(e => console.error('Auto-expiry error:', e));
  }, [devis]);
  const createDevisMutation = useCreateDevis();
  const convertMutation = useConvertDevisToFacture();
  const acompteMutation = useCreateAcompte();
  const deleteDevisMutation = useDeleteDevis();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [socid, setSocid] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([{ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '', prixAchat: 0 }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [insertLotOpen, setInsertLotOpen] = useState(false);

  const emptyLigne = (): LigneForm => ({ desc: '', qty: 1, subprice: 0, tva_tx: 20, product_type: 0, productId: '', prixAchat: 0 });
  const addLigne = () => setLignes([...lignes, emptyLigne()]);

  const insertLot = (groupId: string) => {
    const group = productGroups.find(g => g.id === groupId);
    if (!group) return;
    const newLines: LigneForm[] = group.lines.map(l => ({
      desc: l.desc, qty: l.variable_qty ? 0 : l.qty,
      subprice: l.subprice, tva_tx: l.tva_tx, product_type: l.product_type,
      prixAchat: l.prixAchat, productId: '',
    }));
    // Remove empty placeholder if only one empty line
    const base = lignes.length === 1 && !lignes[0].desc ? [] : lignes;
    setLignes([...base, ...newLines]);
    setInsertLotOpen(false);
    const nbVariable = group.lines.filter(l => l.variable_qty).length;
    if (nbVariable > 0) {
      toast.info(`${nbVariable} ligne${nbVariable > 1 ? 's' : ''} marquée${nbVariable > 1 ? 's' : ''} "Qté à définir" — vérifiez les quantités`);
    } else {
      toast.success(`Lot "${group.nom}" inséré (${group.lines.length} lignes)`);
    }
  };
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));

  const selectProduct = (i: number, productId: string) => {
    const updated = [...lignes];
    if (productId === '__libre__') {
      updated[i] = { ...updated[i], productId: '', desc: '' };
    } else {
      const p = produits.find(pr => pr.id === productId);
      if (p) updated[i] = { ...updated[i], productId, desc: `[${p.ref}] ${p.label}`, subprice: p.prixHT, tva_tx: p.tauxTVA || 20, product_type: p.type === 'main_oeuvre' ? 1 : 0, prixAchat: p.prixAchat || 0 };
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
    const achat = lignes.reduce((s, l) => s + l.qty * l.prixAchat, 0);
    const marge = ht - achat;
    return { ht, marge, pctMarge: ht > 0 ? (marge / ht) * 100 : 0 };
  }, [lignes]);

  const handleCreate = async () => {
    if (!socid || !lignes[0].desc) return;
    const zeroLines = lignes.filter(l => l.qty <= 0);
    if (zeroLines.length > 0) {
      toast.error(`${zeroLines.length} ligne${zeroLines.length > 1 ? 's ont' : ' a'} une quantité à 0 — corrigez avant de créer le devis`);
      return;
    }
    await createDevisMutation.mutateAsync({
      socid,
      lines: lignes.map(l => ({ desc: l.desc, qty: l.qty, subprice: l.subprice, tva_tx: l.tva_tx || 20, product_type: l.product_type, pa_ht: l.prixAchat })),
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

  const filteredDevis = useMemo(() => {
    return devis.filter(d => {
      if (filterStatut !== 'all' && d.fk_statut !== Number(filterStatut)) return false;
      if (filterClient !== 'all' && d.socid !== filterClient) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!d.ref.toLowerCase().includes(q) && !d.client.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [devis, filterStatut, filterClient, searchQuery]);

  const devisClients = useMemo(() => {
    const map = new Map<string, string>();
    devis.forEach(d => { if (d.socid) map.set(d.socid, d.client); });
    return Array.from(map.entries());
  }, [devis]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Devis
            <HelpTooltip text="Les devis vous permettent de proposer un chiffrage à vos clients. Un devis passe par les statuts : Brouillon → Validé → Envoyé → Accepté / Refusé → Facturé." />
          </h1>
          <p className="text-muted-foreground text-sm">Propositions commerciales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-12 px-6 text-base"><Plus className="h-4 w-4" /> Créer un devis</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau devis — Brouillon</DialogTitle></DialogHeader>
            <div className="space-y-5 pt-2">

              {/* Client */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client *</label>
                {socid && (() => { const c = clients.find(x => x.id === socid); return c ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> {c.nom}{c.email ? ` — ${c.email}` : ''}{c.telephone ? ` — ${c.telephone}` : ''}
                  </div>
                ) : null; })()}
                <Select value={socid} onValueChange={setSocid}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}{c.email ? ` — ${c.email}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Lignes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Lignes du devis
                    <HelpTooltip text="Chaque ligne représente une prestation ou une fourniture. Vous pouvez choisir un article du catalogue ou saisir librement. Cochez 'Ajouter au catalogue' pour sauvegarder une ligne libre pour la prochaine fois. Utilisez 'Insérer un lot' pour pré-remplir avec un groupe d'articles fréquent." />
                  </h3>
                  <div className="flex gap-2">
                    {productGroups.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setInsertLotOpen(true)} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                        <Layers className="h-3.5 w-3.5" /> Insérer un lot
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={addLigne} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Ajouter une ligne</Button>
                  </div>
                </div>

                {lignes.map((l, i) => {
                  const ligneHT = l.qty * l.subprice;
                  const ligneAchat = l.qty * l.prixAchat;
                  const ligneMarge = ligneHT - ligneAchat;
                  const lignePct = ligneHT > 0 ? (ligneMarge / ligneHT) * 100 : 0;
                  const hasZeroQty = l.qty <= 0 && !!l.desc;
                  return (
                    <div key={i} className={cn('p-4 rounded-lg border space-y-3', hasZeroQty ? 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700' : 'bg-muted/40 border-border')}>
                      {/* Ligne numéro + supprimer */}
                      <div className="flex items-center justify-between">
                        <span className={cn('text-xs font-semibold uppercase tracking-wide', hasZeroQty ? 'text-red-600' : 'text-muted-foreground')}>
                          Ligne {i + 1}{hasZeroQty && ' — Quantité requise'}
                        </span>
                        {lignes.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeLigne(i)}>
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </Button>
                        )}
                      </div>

                      {/* Article catalogue */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Article du catalogue (optionnel)</label>
                        <Select value={l.productId || '__libre__'} onValueChange={(v) => selectProduct(i, v)}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Choisir un article..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__libre__">✏️ Ligne libre (saisie manuelle)</SelectItem>
                            {produits.map(p => <SelectItem key={p.id} value={p.id}>[{p.ref}] {p.label} — {p.prixHT.toLocaleString('fr-FR')} € HT ({p.type === 'main_oeuvre' ? 'Main d\'œuvre' : 'Fourniture'})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Désignation */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Désignation *</label>
                        <Input placeholder="Description de la prestation ou fourniture..." value={l.desc} onChange={e => updateLigne(i, 'desc', e.target.value)} />
                      </div>

                      {/* Qté / Prix HT / Prix Achat + totaux */}
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
                          <label className="text-xs text-muted-foreground font-medium">Prix achat HT (€)</label>
                          <Input type="number" min="0" step="0.01" value={l.prixAchat} onChange={e => updateLigne(i, 'prixAchat', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Total HT</label>
                          <div className="h-10 flex items-center px-3 rounded-md bg-background border border-border text-sm font-semibold text-foreground">
                            {ligneHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </div>
                        </div>
                      </div>

                      {/* Marge par ligne */}
                      {l.prixAchat > 0 && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">Marge ligne :</span>
                          <span className={cn('font-semibold', ligneMarge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {ligneMarge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € ({lignePct.toFixed(1)}%)
                          </span>
                        </div>
                      )}

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

              {/* Récapitulatif */}
              <div className="rounded-lg bg-muted/50 border border-border p-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total HT</p>
                  <p className="text-lg font-bold text-foreground">{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div className="text-center border-x border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total TTC (20%)</p>
                  <p className="text-lg font-bold text-foreground">{(totals.ht * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Marge brute</p>
                  <p className={cn('text-lg font-bold', totals.marge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {totals.marge.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € <span className="text-sm">({totals.pctMarge.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>

              {lignes.some(l => l.qty <= 0 && !!l.desc) && (
                <p className="text-sm text-red-600 font-medium text-center">
                  Corrigez les lignes avec quantité 0 avant de créer le devis
                </p>
              )}
              <Button onClick={handleCreate} disabled={createDevisMutation.isPending || !socid || !lignes[0].desc || lignes.some(l => l.qty <= 0 && !!l.desc)} className="w-full h-12 text-base">
                {createDevisMutation.isPending ? 'Création en cours...' : 'Créer le devis (Brouillon)'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog — Insérer un lot (création) */}
        <Dialog open={insertLotOpen} onOpenChange={setInsertLotOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Insérer un lot</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              {productGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => insertLot(g.id)}
                  className="w-full text-left rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 p-4 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{g.nom}</span>
                    <span className="text-xs text-muted-foreground">{g.lines.length} ligne{g.lines.length > 1 ? 's' : ''}</span>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {g.lines.map((l, i) => (
                      <span key={i} className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border',
                        l.variable_qty
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-border bg-muted text-muted-foreground'
                      )}>
                        {l.variable_qty ? '⚠ ' : ''}{l.desc.length > 28 ? l.desc.slice(0, 28) + '…' : l.desc}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par ref ou client..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[180px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(DEVIS_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous les clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {devisClients.map(([id, nom]) => <SelectItem key={id} value={id}>{nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-8"></th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Fin validité</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant HT</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Marge</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDevis.map((d) => (
                <Fragment key={d.id}>
                  <tr
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  >
                    <td className="py-3 px-2">
                      {expandedId === d.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 px-2 font-mono text-xs text-foreground">
                      <div className="flex items-center gap-1.5">
                        {d.ref}
                        {(() => {
                          try {
                            const meta = d.note_private ? JSON.parse(d.note_private) : null;
                            if (meta?.from_intervention) return (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 text-[10px] font-medium">
                                <Zap className="h-2.5 w-2.5" />↩ {meta.from_intervention}
                              </span>
                            );
                          } catch {}
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-foreground">{d.client}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{formatDateFR(d.date)}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">
                      {d.finValidite ? (
                        <span className={cn(new Date(d.finValidite) < new Date() && d.fk_statut <= 1 ? 'text-red-500 font-medium' : '')}>
                          {formatDateFR(d.finValidite)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">{d.montantHT.toLocaleString('fr-FR')} €</td>
                    <td className="py-3 px-2 text-right hidden md:table-cell">
                      {(() => {
                        const venteHT = d.lignes.reduce((s, l) => s + l.totalHT, 0);
                        const achatHT = d.lignes.reduce((s, l) => s + (l.prixAchat || 0) * l.quantite, 0);
                        const marge = venteHT - achatHT;
                        const pct = venteHT > 0 ? (marge / venteHT) * 100 : 0;
                        const hasCost = d.lignes.some(l => (l.prixAchat || 0) > 0);
                        if (!hasCost) return <span className="text-muted-foreground text-xs">—</span>;
                        return (
                          <span className={cn('text-xs font-semibold', marge >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {marge.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-2">
                      {(() => {
                        const rs = getDevisRelanceStatus(devisRelanceMap.get(d.id), d.fk_statut, d.dateValidation || d.date);
                        const effectiveStatut =
                          rs.variant === 'a_relancer' ? 'Relance devis' :
                          rs.variant === 'relance'    ? 'Relancé' :
                          d.statut;
                        return <StatusBadge statut={effectiveStatut} />;
                      })()}
                    </td>
                    <td className="py-3 px-2" onClick={e => e.stopPropagation()}>
                      {d.fk_statut === 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {d.ref} ?</AlertDialogTitle>
                              <AlertDialogDescription>Suppression définitive.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteDevisMutation.mutate(d.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                  {expandedId === d.id && (
                    <DevisDetail
                      devis={d}
                      clients={clients}
                      produits={produits}
                      onConvert={async () => { try { await convertMutation.mutateAsync(d.id); } catch {} }}
                      onAcompte={async () => { try { await acompteMutation.mutateAsync({ socid: d.socid || '', montantHT: d.montantHT, devisRef: d.ref }); } catch {} }}
                      convertPending={convertMutation.isPending}
                      acomptePending={acompteMutation.isPending}
                      onCollapse={() => setExpandedId(null)}
                      relanceVariant={getDevisRelanceStatus(devisRelanceMap.get(d.id), d.fk_statut, d.dateValidation || d.date).variant}
                      onMarkRelance={() => markRelanceMutation.mutate(d.id)}
                    />
                  )}
                </Fragment>
              ))}
              {filteredDevis.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Aucun devis trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
