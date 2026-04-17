import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConfig } from '@/hooks/useConfig';
import { StatusBadge } from '@/components/StatusBadge';
import {
  useInterventions, useClients, useCreateIntervention, useCreateDevis, useCreateFacture,
  useValidateIntervention, useDeleteIntervention, useCloseIntervention, useSetInterventionStatus,
  useDolibarrUsers, useSaveSignatures, useUpdateIntervention, useDevis, useFactures,
  useCreateClient, useReopenIntervention, useProduits,
  useInterventionLines,
} from '@/hooks/useDolibarr';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import {
  statutsIntervention, typesIntervention, formatDateFR, openPDFInNewTab,
  sendInterventionByEmail, resolveTechnicianName, getInterventionSignatures,
  updateIntervention, deleteIntervention, setInterventionStatus,
  type InterventionType, type Intervention, type InterventionLine,
} from '@/services/dolibarr';
import { generateInterventionPdfLocal, generateInterventionPdfBlobUrl } from '@/services/interventionPdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CollisionAlert, checkCollision, type InterventionSlot } from '@/components/CollisionAlert';
import { SignaturePad, type SignaturePadRef } from '@/components/SignaturePad';
import { Plus, FileText, Receipt, Clock, ArrowRightLeft, Lock, FileDown, FileCheck, Trash2, Send, Play, CheckCircle2, Search, Pencil, RefreshCw, XCircle, RotateCcw, ListPlus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/contexts/AuthContext';

const typeLabels: Record<InterventionType, string> = {
  devis: 'Devis', panne: 'Panne', panne_urgence: 'Panne urgence', sav: 'SAV', chantier: 'Chantier',
};

const typeColors: Record<InterventionType, string> = {
  devis: 'bg-blue-100 text-blue-700 border-blue-200',
  panne: 'bg-red-100 text-red-700 border-red-200',
  panne_urgence: 'bg-rose-100 text-rose-700 border-rose-200',
  sav: 'bg-orange-100 text-orange-700 border-orange-200',
  chantier: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export default function Interventions() {
  const { config } = useConfig();
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [], isError: clientsError } = useClients();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const { data: allDevis = [] } = useDevis();
  const { data: allFactures = [] } = useFactures();
  const { data: produits = [] } = useProduits();
  const queryClient = useQueryClient();
  const createInterventionMutation = useCreateIntervention();
  const createDevisMutation = useCreateDevis();
  const createFactureMutation = useCreateFacture();
  const createClientMutation = useCreateClient();
  const validateMutation = useValidateIntervention();
  const deleteMutation = useDeleteIntervention();
  const closeMutation = useCloseIntervention();
  const statusMutation = useSetInterventionStatus();
  const saveSignaturesMutation = useSaveSignatures();
  const updateMutation = useUpdateIntervention();
  
  const reopenMutation = useReopenIntervention();
  const { role } = useAuth();

  const [deleteAllPending, setDeleteAllPending] = useState(false);

  const handleDeleteSingle = async (id: string, fk_statut: number) => {
    try {
      if (fk_statut !== 0) {
        await setInterventionStatus(id, 0);
      }
      await deleteMutation.mutateAsync(id);
      setDetailOpen(false);
    } catch (e: any) {
      toast.error(`Erreur suppression : ${e.message || e}`);
    }
  };

  const handleDeleteAll = async () => {
    setDeleteAllPending(true);
    let count = 0;
    try {
      for (const intervention of interventions) {
        if (intervention.fk_statut !== 0) {
          await setInterventionStatus(intervention.id, 0);
        }
        await deleteIntervention(intervention.id);
        count++;
      }
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success(`${count} intervention(s) supprimée(s)`);
    } catch (e: any) {
      toast.error(`Erreur suppression : ${e.message || e}`);
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    }
    setDeleteAllPending(false);
  };

  // New client inline form state
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [ncNom, setNcNom] = useState('');
  const [ncAdresse, setNcAdresse] = useState('');
  const [ncCodePostal, setNcCodePostal] = useState('');
  const [ncVille, setNcVille] = useState('');
  const [ncTelephone, setNcTelephone] = useState('');
  const [ncEmail, setNcEmail] = useState('');

  const linkedDocsByIntervention = useMemo(() => {
    const map = new Map<string, { devis: string[]; factures: string[] }>();
    allDevis.forEach(d => {
      if (d.note_private) {
        try {
          const meta = JSON.parse(d.note_private);
          if (meta.from_intervention) {
            const key = meta.intervention_id || meta.from_intervention;
            const entry = map.get(key) || { devis: [], factures: [] };
            entry.devis.push(d.ref);
            map.set(key, entry);
          }
        } catch {}
      }
    });
    allFactures.forEach(f => {
      if (f.note_private) {
        try {
          const meta = JSON.parse(f.note_private);
          if (meta.from_intervention) {
            const key = meta.intervention_id || meta.from_intervention;
            const entry = map.get(key) || { devis: [], factures: [] };
            entry.factures.push(f.ref);
            map.set(key, entry);
          }
        } catch {}
      }
    });
    return map;
  }, [allDevis, allFactures]);

  const [techFilter, setTechFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  // Edit draft state
  const [editOpen, setEditOpen] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editTech, setEditTech] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHeureDebut, setEditHeureDebut] = useState('08:00');
  const [editHeureFin, setEditHeureFin] = useState('10:00');
  const [editType, setEditType] = useState<InterventionType>('devis');
  const [editNotePrivee, setEditNotePrivee] = useState('');

  const [newTech, setNewTech] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newHeureDebut, setNewHeureDebut] = useState('08:00');
  const [newHeureFin, setNewHeureFin] = useState('10:00');
  const [newType, setNewType] = useState<InterventionType | ''>('');
  const [newDescription, setNewDescription] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientSearch, setNewClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [notePrivee, setNotePrivee] = useState('');

  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionInfo, setCollisionInfo] = useState({ technicien: '', creneauExistant: '' });
  const [confirmTerminerOpen, setConfirmTerminerOpen] = useState(false);

  // Horloge live — définie après currentTime, mise à jour toutes les secondes
  const [liveTime, setLiveTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setLiveTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureTechData, setSignatureTechData] = useState<string | null>(null);
  const sigClientRef = useRef<SignaturePadRef>(null);
  const sigTechRef = useRef<SignaturePadRef>(null);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Tech note & arrival/departure (internal, not on PDF)
  const [techNote, setTechNote] = useState('');
  const [heureArrivee, setHeureArrivee] = useState('');
  const [heureDepart, setHeureDepart] = useState('');
  // App-side "En cours" state — stored in note_public, not sent to Dolibarr as fk_statut
  const [appEnCours, setAppEnCours] = useState(false);

  // P1: Lines state
  const { data: interventionLines = [] } = useInterventionLines(selectedIntervention?.id);

  // P2: Facture conversion dialog
  const [factureDialogOpen, setFactureDialogOpen] = useState(false);
  const [factureLines, setFactureLines] = useState<{ desc: string; qty: number; subprice: number; tva_tx: number }[]>([]);
  const [factureIntervention, setFactureIntervention] = useState<Intervention | null>(null);

  // P5: Load saved signatures
  useEffect(() => {
    if (selectedIntervention && detailOpen) {
      getInterventionSignatures(selectedIntervention.id).then(sigs => {
        setSignatureData(sigs?.signature_client || null);
        setSignatureTechData(sigs?.signature_tech || null);
      });
    }
  }, [selectedIntervention?.id, detailOpen]);

  const resolvedInterventions = interventions.map(i => {
    const techFromMeta = resolveTechnicianName(i.technicien, dolibarrUsers);
    const techFromAuthor = resolveTechnicianName(i.user_author_id, dolibarrUsers);
    const isNumericId = i.technicien && /^\d+$/.test(i.technicien);
    const techName = isNumericId ? (techFromMeta || techFromAuthor) : (i.technicien || techFromAuthor);
    return { ...i, technicien: techName || '' };
  });

  const technicienNames = dolibarrUsers.map(u => u.fullname).filter(Boolean);

  const filtered = resolvedInterventions.filter((i) => {
    if (techFilter !== 'all' && i.technicien !== techFilter) return false;
    if (statutFilter !== 'all' && i.statut !== statutFilter) return false;
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!i.ref?.toLowerCase().includes(q) && !i.client?.toLowerCase().includes(q) && !i.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const resetNewClientForm = () => {
    setShowNewClientForm(false);
    setNcNom(''); setNcAdresse(''); setNcCodePostal(''); setNcVille(''); setNcTelephone(''); setNcEmail('');
  };

  const handleCreate = async () => {
    let clientId = newClientId;
    if (showNewClientForm) {
      if (!ncNom.trim() || !ncAdresse.trim() || !ncCodePostal.trim() || !ncVille.trim() || !ncTelephone.trim() || !ncEmail.trim()) {
        toast.error('Tous les champs du client sont obligatoires');
        return;
      }
      try {
        const result = await createClientMutation.mutateAsync({
          nom: ncNom, adresse: ncAdresse, codePostal: ncCodePostal, ville: ncVille, telephone: ncTelephone, email: ncEmail,
        });
        clientId = String(result);
      } catch { return; }
    }

    if (!clientId || !newDate) { toast.error((!clientId && newClientSearch) ? 'Sélectionnez un client dans la liste ou créez-en un nouveau' : 'Veuillez remplir client et date'); return; }
    if (!newDescription.trim()) { toast.error('La description est obligatoire'); return; }

    // Bloquer si la date est aujourd'hui et l'heure de début est déjà passée
    if (newDate === todayStr() && newHeureDebut < currentTime()) {
      toast.error(`Il est ${currentTime()} — impossible de planifier une intervention à ${newHeureDebut} (heure déjà passée)`);
      return;
    }

    const slots: InterventionSlot[] = resolvedInterventions.map(i => ({
      technicien: i.technicien, date: i.date, heureDebut: i.heureDebut, heureFin: i.heureFin, ref: i.ref,
    }));
    const collision = checkCollision({ technicien: newTech, date: newDate, heureDebut: newHeureDebut, heureFin: newHeureFin }, slots);
    if (collision) {
      setCollisionInfo({ technicien: newTech, creneauExistant: `${collision.ref || 'Intervention'} — ${collision.date} de ${collision.heureDebut} à ${collision.heureFin}` });
      setCollisionOpen(true);
      return;
    }

    const selectedUser = dolibarrUsers.find(u => u.fullname === newTech);
    await createInterventionMutation.mutateAsync({
      socid: clientId, description: newDescription || ' ', date: newDate,
      heureDebut: newHeureDebut, heureFin: newHeureFin,
      fk_user_assign: selectedUser?.id, type: (newType || 'devis') as InterventionType, note_private: notePrivee || undefined,
    });
    setDialogOpen(false);
    setNewClientId(''); setNewClientSearch(''); setNewDescription(''); setNewDate(''); setNewTech(''); setNotePrivee(''); setNewType('');
    resetNewClientForm();
  };

  const roundToQuarterHour = (date: Date): string => {
    const minutes = Math.round(date.getMinutes() / 15) * 15;
    const h = date.getHours() + Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const currentTime = (): string => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const todayStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const addTwoHours = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const total = (h + 2) % 24;
    return `${String(total).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  };

  // Silent save of appStatus to note_public (en_cours or cleared)
  const saveAppStatus = async (status: 'en_cours' | null) => {
    if (!selectedIntervention) return;
    try {
      const existing = selectedIntervention.descriptionClient
        ? (() => { try { return JSON.parse(selectedIntervention.descriptionClient!); } catch { return {}; } })()
        : {};
      if (status === null) { delete existing.appStatus; } else { existing.appStatus = status; }
      const techInfo = JSON.stringify(existing);
      await updateIntervention(selectedIntervention.id, { note_public: techInfo });
      setSelectedIntervention(prev => prev ? { ...prev, descriptionClient: techInfo } : prev);
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    } catch {}
  };

  // Silent auto-save: persist arrival/departure times in note_public without showing a toast
  const autoSaveTimes = async (arrivee: string, depart: string) => {
    if (!selectedIntervention) return;
    try {
      const existing = selectedIntervention.descriptionClient
        ? (() => { try { return JSON.parse(selectedIntervention.descriptionClient!); } catch { return {}; } })()
        : {};
      const techInfo = JSON.stringify({ ...existing, heureArrivee: arrivee, heureDepart: depart });
      await updateIntervention(selectedIntervention.id, { note_public: techInfo });
      // Update local state so closing/reopening the panel reads the saved values
      setSelectedIntervention(prev => prev ? { ...prev, descriptionClient: techInfo } : prev);
    } catch { /* silent — no toast on auto-save failure */ }
  };

  const openDetail = (inter: Intervention) => {
    setSelectedIntervention(inter);
    setDetailOpen(true);
    // Restore saved tech info from note_public (descriptionClient) if it exists
    let restoredNote = '';
    let restoredArrivee = '';
    let restoredDepart = '';
    let restoredAppEnCours = false;
    if (inter.descriptionClient) {
      try {
        const saved = JSON.parse(inter.descriptionClient);
        restoredNote = saved.techNote || '';
        restoredArrivee = saved.heureArrivee || '';
        restoredDepart = saved.heureDepart || '';
        restoredAppEnCours = saved.appStatus === 'en_cours';
      } catch { /* not JSON, ignore */ }
    }
    setTechNote(restoredNote);
    setAppEnCours(restoredAppEnCours);
    // Default arrival to the planned RDV start time if not already saved
    setHeureArrivee(restoredArrivee || inter.heureDebut || '');
    // Auto-fill departure with current time rounded to 15 min if not already saved
    setHeureDepart(restoredDepart || roundToQuarterHour(new Date()));
  };

  const handleTransformDevis = async (inter: Intervention) => {
    const socid = inter.socid;
    if (!socid) { toast.error('Client non identifié'); return; }
    const notePrivate = JSON.stringify({ from_intervention: inter.ref, intervention_id: inter.id });
    await createDevisMutation.mutateAsync({
      socid,
      lines: [{ desc: `Intervention ${inter.ref} — ${inter.description || 'Prestation'}`, qty: 1, subprice: 0, tva_tx: 20, product_type: 1 }],
      note_private: notePrivate,
    });
    toast.success('Devis créé depuis l\'intervention');
  };

  // P2: Open facture conversion dialog with line editor
  const openFactureDialog = (inter: Intervention) => {
    if (!inter.socid) { toast.error('Client non identifié'); return; }
    setFactureIntervention(inter);
    // Pre-fill with intervention lines if available
    const preLines = interventionLines.length > 0
      ? interventionLines.map(l => ({ desc: l.description, qty: Math.max(1, Math.round(l.duree / 3600 * 100) / 100), subprice: 45, tva_tx: 20 }))
      : [{ desc: `Intervention ${inter.ref} — ${inter.description || 'Prestation'}`, qty: 1, subprice: 0, tva_tx: 20 }];
    setFactureLines(preLines);
    setFactureDialogOpen(true);
  };

  const handleCreateFactureFromLines = async () => {
    if (!factureIntervention?.socid) return;
    const notePrivate = JSON.stringify({ from_intervention: factureIntervention.ref, intervention_id: factureIntervention.id });
    await createFactureMutation.mutateAsync({
      socid: factureIntervention.socid,
      lines: factureLines.map(l => ({ ...l, product_type: 1 })),
      note_private: notePrivate,
    });
    toast.success('Facture créée depuis l\'intervention');
    setFactureDialogOpen(false);
  };

  const handleViewPDF = async () => {
    if (!selectedIntervention) return;
    setGeneratingPDF(true);
    try {
      const client = clients.find(c => c.id === selectedIntervention.socid);
      const blobUrl = generateInterventionPdfBlobUrl({
        intervention: selectedIntervention,
        client,
        lines: interventionLines,
        entreprise: config.entreprise,
        signatureClient: signatureData || undefined,
        signatureTech: signatureTechData || undefined,
      });
      setPdfPreviewUrl(blobUrl);
      setPdfPreviewOpen(true);
    } catch (e: any) { toast.error(`Erreur PDF : ${e.message || e}`); }
    finally { setGeneratingPDF(false); }
  };

  const handleSendEmail = async () => {
    if (!selectedIntervention || !emailDest) return;

    const defaultSubject = `Électricien du Genevois - Bon d'intervention ${selectedIntervention.ref}`;
    const defaultMessage = `Bonjour,\n\nVous trouverez ci-joint votre bon d'intervention ${selectedIntervention.ref} terminé.\n\nCordialement,\nÉlectricien du Genevois`;

    setSendingEmail(true);
    try {
      await sendInterventionByEmail(
        selectedIntervention.id,
        emailDest,
        emailObjet.trim() || defaultSubject,
        emailMessage.trim() || defaultMessage,
      );
      toast.success('Bon d\'intervention envoyé par email');
      setEmailOpen(false);
    } catch (e: any) {
      toast.error(`Erreur envoi : ${e.message || e}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const openEditDraft = () => {
    if (!selectedIntervention) return;
    setEditDescription(selectedIntervention.description || '');
    setEditTech(selectedIntervention.technicien || '');
    setEditDate(selectedIntervention.date || '');
    setEditHeureDebut(selectedIntervention.heureDebut || '08:00');
    setEditHeureFin(selectedIntervention.heureFin || '10:00');
    setEditType(selectedIntervention.type || 'devis');
    setEditNotePrivee(selectedIntervention.compteRendu || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedIntervention) return;
    if (!editDescription.trim()) { toast.error('La description est obligatoire'); return; }
    const slots: InterventionSlot[] = resolvedInterventions
      .filter(i => i.id !== selectedIntervention.id)
      .map(i => ({ technicien: i.technicien, date: i.date, heureDebut: i.heureDebut, heureFin: i.heureFin, ref: i.ref }));
    const collision = checkCollision({ technicien: editTech, date: editDate, heureDebut: editHeureDebut, heureFin: editHeureFin }, slots);
    if (collision) {
      setCollisionInfo({ technicien: editTech, creneauExistant: `${collision.ref || 'Intervention'} — ${collision.date} de ${collision.heureDebut} à ${collision.heureFin}` });
      setCollisionOpen(true);
      return;
    }
    const selectedUser = dolibarrUsers.find(u => u.fullname === editTech);
    const dateTimestamp = editDate ? Math.floor(new Date(`${editDate}T12:00:00`).getTime() / 1000) : undefined;
    const metadata = JSON.stringify({
      type: editType || 'devis', technicien: selectedUser?.id || editTech || '',
      heureDebut: editHeureDebut || '08:00', heureFin: editHeureFin || '10:00',
      dateIntervention: editDate || '', notePrivee: editNotePrivee || '',
    });
    await updateMutation.mutateAsync({
      id: selectedIntervention.id, description: editDescription || ' ',
      fk_user_assign: selectedUser?.id, dateo: dateTimestamp, datee: dateTimestamp, note_private: metadata,
    });
    setEditOpen(false);
    setDetailOpen(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interventions</h1>
          <p className="text-muted-foreground text-sm">Planning et suivi — statuts natifs Dolibarr</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2 h-12 px-4"
                disabled={deleteAllPending || interventions.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                {deleteAllPending ? 'Suppression...' : 'Tout supprimer'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer toutes les interventions ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera définitivement les <strong>{interventions.length}</strong> intervention(s). Cette opération est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">
                  Tout supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setShowClientSuggestions(false); setNewClientSearch(''); setNewClientId(''); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Nouvelle intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle intervention (Brouillon)</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {!showNewClientForm ? (
                <div className="relative">
                  <Input
                    placeholder="Client"
                    value={newClientSearch}
                    onChange={e => { setNewClientSearch(e.target.value); setNewClientId(''); setShowClientSuggestions(true); }}
                    onClick={() => setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                    autoComplete="off"
                    className="pr-8"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onMouseDown={e => { e.preventDefault(); setShowClientSuggestions(v => !v); }}
                  >
                    <ChevronDown className={cn('h-4 w-4 transition-transform', showClientSuggestions && 'rotate-180')} />
                  </button>
                  {showClientSuggestions && (
                    <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
                      {(() => {
                        const filtered = clients.filter(c => !newClientSearch || c.nom.toLowerCase().includes(newClientSearch.toLowerCase())).slice(0, 8);
                        return filtered.length > 0 ? filtered.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onMouseDown={() => { setNewClientId(c.id); setNewClientSearch(c.nom); setShowClientSuggestions(false); }}
                          >
                            {c.nom}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground italic">
                            {clientsError ? 'Erreur Dolibarr — vérifiez la connexion' : clients.length === 0 ? 'Aucun client dans Dolibarr' : 'Aucun résultat'}
                          </p>
                        );
                      })()}
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-primary font-medium hover:bg-muted border-t border-border"
                        onMouseDown={() => { setShowNewClientForm(true); setNcNom(newClientSearch); setShowClientSuggestions(false); }}
                      >
                        ＋ Nouveau client
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Nouveau client</h3>
                    <Button variant="ghost" size="sm" onClick={resetNewClientForm} className="text-xs">Annuler</Button>
                  </div>
                  <Input placeholder="Nom du client *" value={ncNom} onChange={e => setNcNom(e.target.value)} />
                  <AddressAutocomplete value={ncAdresse} onSelect={({ rue, codePostal: cp, ville: v }) => { setNcAdresse(rue); setNcCodePostal(cp); setNcVille(v); }} placeholder="Adresse *" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Code postal *" value={ncCodePostal} onChange={e => setNcCodePostal(e.target.value)} />
                    <Input placeholder="Ville *" value={ncVille} onChange={e => setNcVille(e.target.value)} />
                  </div>
                  <Input placeholder="Téléphone *" value={ncTelephone} onChange={e => setNcTelephone(e.target.value)} />
                  <Input placeholder="Email *" type="email" value={ncEmail} onChange={e => setNcEmail(e.target.value)} />
                </div>
              )}
              <Select value={newType} onValueChange={(v) => setNewType(v as InterventionType)}>
                <SelectTrigger><SelectValue placeholder="Type d'intervention" /></SelectTrigger>
                <SelectContent>
                  {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newTech} onValueChange={setNewTech}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un technicien" /></SelectTrigger>
                <SelectContent>
                  {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  {technicienNames.length === 0 && <SelectItem value="none" disabled>Aucun utilisateur Dolibarr</SelectItem>}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" className="shrink-0 px-3 text-xs" onClick={() => { const d = new Date(); setNewDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }}>
                  Aujourd'hui
                </Button>
              </div>
              {(() => {
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Début</label>
                      <div className="flex gap-1">
                        <Input
                          type="time"
                          value={newHeureDebut}
                          onChange={e => { setNewHeureDebut(e.target.value); setNewHeureFin(addTwoHours(e.target.value)); }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-10 w-10"
                          title="Heure actuelle"
                          onClick={() => { const t = currentTime(); setNewHeureDebut(t); setNewHeureFin(addTwoHours(t)); }}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fin</label>
                      <div className="flex gap-1">
                        <Input
                          type="time"
                          value={newHeureFin}
                          onChange={e => setNewHeureFin(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-10 w-10"
                          title="Heure actuelle"
                          onClick={() => setNewHeureFin(currentTime())}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <Input placeholder="Description technique" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              {role === 'admin' && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Note privée (admin)
                  </h3>
                  <Textarea placeholder="Note visible uniquement par les administrateurs..." value={notePrivee} onChange={(e) => setNotePrivee(e.target.value)} className="min-h-[60px]" />
                </div>
              )}
              <Button onClick={handleCreate} disabled={createInterventionMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
                {createInterventionMutation.isPending ? 'Création...' : "Créer (Brouillon)"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par réf, client, description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statutsIntervention.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Technicien</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Type</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden lg:table-cell">Horaire</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Aucune intervention trouvée</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => openDetail(i)}>
                    <td className="py-3 px-2 font-mono text-xs text-foreground">{i.ref}</td>
                    <td className="py-3 px-2 text-foreground">{i.client}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{i.technicien || '—'}</td>
                    <td className="py-3 px-2 hidden md:table-cell">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs', typeColors[i.type] || 'bg-muted text-muted-foreground')}>
                        {typeLabels[i.type] || i.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground hidden lg:table-cell text-xs">
                      <Clock className="inline h-3 w-3 mr-1" />{i.heureDebut}–{i.heureFin}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{formatDateFR(i.date)}</td>
                    <td className="py-3 px-2">{(() => {
                      if (i.fk_statut === 1 && i.descriptionClient) {
                        try { if (JSON.parse(i.descriptionClient).appStatus === 'en_cours') return <StatusBadge statut="En cours" />; } catch {}
                      }
                      return <StatusBadge statut={i.statut} />;
                    })()}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const linked = linkedDocsByIntervention.get(i.id) || linkedDocsByIntervention.get(i.ref);
                          return (
                            <>
                              {linked?.devis.map(ref => (
                                <span key={ref} className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium" title={`Devis ${ref}`}>
                                  <FileText className="h-2.5 w-2.5" />{ref}
                                </span>
                              ))}
                              {linked?.factures.map(ref => (
                                <span key={ref} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium" title={`Facture ${ref}`}>
                                  <Receipt className="h-2.5 w-2.5" />{ref}
                                </span>
                              ))}
                            </>
                          );
                        })()}
                        {(i.fk_statut === 3 || i.fk_statut === 5) && role !== 'technicien' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Générer facture" onClick={() => openFactureDialog(i)}>
                            <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {(i.fk_statut === 3 || i.fk_statut === 5) && role !== 'technicien' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Transformer en Devis" onClick={() => handleTransformDevis(i)}>
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIntervention && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedIntervention.ref}
                  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs ml-2', typeColors[selectedIntervention.type])}>
                    {typeLabels[selectedIntervention.type]}
                  </span>
                  <StatusBadge statut={selectedIntervention.fk_statut === 1 && appEnCours ? 'En cours' : selectedIntervention.statut} />
                </DialogTitle>
              </DialogHeader>

              {/* Linked documents */}
              {(() => {
                const linked = linkedDocsByIntervention.get(selectedIntervention.id) || linkedDocsByIntervention.get(selectedIntervention.ref);
                if (!linked || (linked.devis.length === 0 && linked.factures.length === 0)) return null;
                return (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {linked.devis.map(ref => (
                      <span key={ref} className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-medium">
                        <FileText className="h-3 w-3" /> Devis {ref}
                      </span>
                    ))}
                    {linked.factures.map(ref => (
                      <span key={ref} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
                        <Receipt className="h-3 w-3" /> Facture {ref}
                      </span>
                    ))}
                  </div>
                );
              })()}

              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Client :</span> <span className="text-foreground ml-1">{selectedIntervention.client}</span></div>
                  <div><span className="text-muted-foreground">Technicien :</span> <span className="text-foreground ml-1">{selectedIntervention.technicien || '—'}</span></div>
                  <div><span className="text-muted-foreground">Date :</span> <span className="text-foreground ml-1">{formatDateFR(selectedIntervention.date)}</span></div>
                  <div><span className="text-muted-foreground">Horaire :</span> <span className="text-foreground ml-1">{selectedIntervention.heureDebut} – {selectedIntervention.heureFin}</span></div>
                </div>

                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground font-medium">Description :</span>
                  <p className="text-foreground bg-muted/50 p-2 rounded">{selectedIntervention.description || '—'}</p>
                </div>

                {selectedIntervention.descriptionClient && (
                  <div className="text-sm space-y-1">
                    <span className="text-muted-foreground font-medium">Note publique :</span>
                    <p className="text-foreground bg-muted/50 p-2 rounded">{selectedIntervention.descriptionClient}</p>
                  </div>
                )}

                {role === 'admin' && (
                  <div className="space-y-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-orange-500" /> Note privée
                    </h3>
                    <p className="text-sm text-foreground">{selectedIntervention.compteRendu || '—'}</p>
                  </div>
                )}

                {/* Lignes d'intervention (lecture seule) */}
                {interventionLines.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ListPlus className="h-4 w-4" /> Lignes d'intervention ({interventionLines.length})
                    </h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left py-2 px-3 text-muted-foreground">Description</th>
                            <th className="text-left py-2 px-3 text-muted-foreground">Date</th>
                            <th className="text-left py-2 px-3 text-muted-foreground">Durée</th>
                          </tr>
                        </thead>
                        <tbody>
                          {interventionLines.map((line) => (
                            <tr key={line.id} className="border-t border-border/50">
                              <td className="py-2 px-3 text-foreground">{line.description}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDateFR(line.date)}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDuration(line.duree)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Heure d'arrivée — capture automatique, non modifiable */}
                {selectedIntervention.fk_statut === 1 && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Heure d'arrivée
                    </h3>
                    {!heureArrivee ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        disabled={appEnCours}
                        onClick={() => { const t = currentTime(); setHeureArrivee(t); autoSaveTimes(t, heureDepart); }}
                      >
                        <Clock className="h-4 w-4" /> Enregistrer mon arrivée ({liveTime})
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-semibold text-emerald-700">Arrivée enregistrée à {heureArrivee}</span>
                        <span className="text-xs text-emerald-600 ml-auto">🔒 non modifiable</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tech note, heure de départ — visible seulement En cours ou terminée */}
                {(appEnCours || selectedIntervention.fk_statut >= 3) && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Suivi technicien (interne)
                    </h3>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Heure de départ {selectedIntervention.fk_statut < 3 && <span className="text-destructive">*</span>}</label>
                      {selectedIntervention.fk_statut >= 3 ? (
                        <div className="px-3 py-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">{heureDepart || '—'}</div>
                      ) : !heureDepart ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => { const t = currentTime(); setHeureDepart(t); autoSaveTimes(heureArrivee, t); }}
                        >
                          <Clock className="h-4 w-4" /> Enregistrer mon départ ({liveTime})
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-sm font-semibold text-emerald-700">Départ enregistré à {heureDepart}</span>
                          <span className="text-xs text-emerald-600 ml-auto">🔒 non modifiable</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Note du technicien {selectedIntervention.fk_statut < 3 && <span className="text-destructive">*</span>}</label>
                      <Textarea
                        placeholder="Décrivez le travail effectué, les observations..."
                        value={techNote}
                        onChange={e => setTechNote(e.target.value)}
                        className="min-h-[80px]"
                        disabled={selectedIntervention.fk_statut >= 3}
                      />
                    </div>
                  </div>
                )}

                {/* Signatures - only when En cours (app) or already finished */}
                {(appEnCours || selectedIntervention.fk_statut >= 3) && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      ✅ Signatures {selectedIntervention.fk_statut < 3 && !signatureData && !signatureTechData && <span className="text-xs text-destructive font-normal ml-2">* obligatoires pour terminer</span>}
                    </h3>

                    {/* Saved signatures — always shown when available */}
                    {(signatureData || signatureTechData) && (
                      <div className="grid grid-cols-2 gap-4">
                        {signatureData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Signature client ✓</p>
                            <img src={signatureData} alt="Signature client" className="border border-border rounded max-h-20" />
                          </div>
                        )}
                        {signatureTechData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Signature technicien ✓</p>
                            <img src={signatureTechData} alt="Signature technicien" className="border border-border rounded max-h-20" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Signature pads — only shown when at least one is missing AND not finished */}
                    {selectedIntervention.fk_statut < 3 && (!signatureData || !signatureTechData) && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {!signatureData && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Signature du client <span className="text-destructive">*</span></p>
                              <SignaturePad ref={sigClientRef} onSave={(data) => setSignatureData(data)} />
                            </div>
                          )}
                          {!signatureTechData && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Signature du technicien <span className="text-destructive">*</span></p>
                              <SignaturePad ref={sigTechRef} onSave={(data) => setSignatureTechData(data)} />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              sigClientRef.current?.clear();
                              sigTechRef.current?.clear();
                              setSignatureData(null);
                              setSignatureTechData(null);
                            }}
                          >
                            Effacer
                          </Button>
                          <Button
                            type="button"
                            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                            disabled={!signatureData || !signatureTechData || saveSignaturesMutation.isPending}
                            onClick={async () => {
                              if (!signatureData || !signatureTechData) {
                                toast.error(!signatureData ? 'Signature client manquante' : 'Signature technicien manquante');
                                return;
                              }
                              await saveSignaturesMutation.mutateAsync({
                                id: selectedIntervention.id,
                                signatureClient: signatureData,
                                signatureTech: signatureTechData,
                                ref: selectedIntervention.ref,
                              });
                              toast.success('Signatures enregistrées');
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {saveSignaturesMutation.isPending ? 'Enregistrement...' : 'Valider'}
                          </Button>
                        </div>
                        <p className="text-xs text-center text-amber-600">
                          {!signatureData && !signatureTechData ? 'Signez les 2 cases ci-dessus' : !signatureData ? 'Signature client manquante' : 'Signature technicien manquante'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {/* Brouillon (0) — admin/secrétaire only (techniciens don't see brouillons) */}
                  {selectedIntervention.fk_statut === 0 && (
                    <>
                      <Button onClick={openEditDraft} variant="outline" className="gap-2">
                        <Pencil className="h-4 w-4" /> Modifier
                      </Button>
                      <Button onClick={async () => { await validateMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} disabled={validateMutation.isPending} className="gap-2">
                        <Play className="h-4 w-4" /> {validateMutation.isPending ? 'Validation...' : 'Valider'}
                      </Button>
                    </>
                  )}

                  {/* Supprimer — brouillon (0) ou validée (1), admin/secrétaire uniquement */}
                  {(selectedIntervention.fk_statut === 0 || selectedIntervention.fk_statut === 1) && role !== 'technicien' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="gap-2 border-destructive/30 text-destructive" disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer {selectedIntervention.ref} ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Suppression définitive.{selectedIntervention.fk_statut === 1 ? " L'intervention sera repassée en brouillon puis supprimée." : ''}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteSingle(selectedIntervention.id, selectedIntervention.fk_statut)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {/* Validée (1) + pas encore démarrée → Démarrer (app-side only) */}
                  {selectedIntervention.fk_statut === 1 && !appEnCours && (
                    <Button
                      onClick={async () => {
                        // L'heure d'arrivée doit être enregistrée via le bouton de capture
                        if (!heureArrivee) {
                          toast.error('Enregistrez d\'abord votre heure d\'arrivée en cliquant sur le bouton ci-dessus');
                          return;
                        }

                        // Vérifier qu'un technicien ne démarre pas 2 interventions en même temps
                        const techName = selectedIntervention.technicien;
                        if (techName) {
                          const autresEnCours = resolvedInterventions.filter(i => {
                            if (i.id === selectedIntervention.id) return false;
                            if (i.fk_statut !== 1) return false;
                            if (i.technicien !== techName) return false;
                            try { return JSON.parse(i.descriptionClient || '{}').appStatus === 'en_cours'; }
                            catch { return false; }
                          });
                          const conflit = autresEnCours.filter(i => i.socid !== selectedIntervention.socid);
                          if (conflit.length > 0) {
                            toast.error(`${techName} est déjà en cours sur ${conflit.map(i => i.ref).join(', ')} — impossible de démarrer 2 interventions simultanées`);
                            return;
                          }
                        }

                        setAppEnCours(true);
                        await saveAppStatus('en_cours');
                      }}
                      className="gap-2 bg-orange-500 hover:bg-orange-600"
                    >
                      <Play className="h-4 w-4" /> Démarrer l'intervention
                    </Button>
                  )}

                  {/* En cours (app) → Terminer dans Dolibarr */}
                  {selectedIntervention.fk_statut === 1 && appEnCours && (
                    <>
                      <Button
                        onClick={() => {
                          if (!heureArrivee) { toast.error('Enregistrez d\'abord votre heure d\'arrivée'); return; }
                          if (!heureDepart) { toast.error('Enregistrez d\'abord votre heure de départ en cliquant sur le bouton ci-dessus'); return; }
                          if (heureArrivee >= heureDepart) { toast.error('L\'heure d\'arrivée doit être avant l\'heure de départ'); return; }
                          // Sécurité finale : heure de départ ne peut pas être dans le futur
                          if (heureDepart > currentTime()) {
                            toast.error(`Il est ${currentTime()} sur votre appareil — impossible de terminer à ${heureDepart}`);
                            return;
                          }
                          if (!techNote.trim()) { toast.error('La note du technicien est obligatoire'); return; }
                          if (!signatureData) { toast.error('Signature client manquante'); return; }
                          if (!signatureTechData) { toast.error('Signature technicien manquante'); return; }
                          setConfirmTerminerOpen(true);
                        }}
                        disabled={closeMutation.isPending || updateMutation.isPending}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> {closeMutation.isPending ? '...' : 'Terminer l\'intervention'}
                      </Button>
                      <AlertDialog open={confirmTerminerOpen} onOpenChange={setConfirmTerminerOpen}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Terminer l'intervention ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Êtes-vous sûr de vouloir terminer cette intervention ? Une fois terminée, <strong>aucune modification ne sera possible</strong>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={async () => {
                                const techInfo = JSON.stringify({ techNote, heureArrivee, heureDepart });
                                await updateMutation.mutateAsync({ id: selectedIntervention.id, note_public: techInfo });
                                await closeMutation.mutateAsync(selectedIntervention.id);
                                setConfirmTerminerOpen(false);
                                setDetailOpen(false);
                              }}
                            >
                              Oui, terminer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}

                  {/* Terminée (3 ou 5) → Rouvrir — admin uniquement */}
                  {(selectedIntervention.fk_statut === 3 || selectedIntervention.fk_statut === 5) && role === 'admin' && (
                    <Button onClick={async () => {
                      await reopenMutation.mutateAsync(selectedIntervention.id);
                      // reopen → statut=0, validate → statut=1, then set app En cours
                      try { await validateMutation.mutateAsync(selectedIntervention.id); } catch {}
                      await saveAppStatus('en_cours');
                      setAppEnCours(true);
                      setDetailOpen(false);
                    }} disabled={reopenMutation.isPending} className="gap-2">
                      <RotateCcw className="h-4 w-4" /> {reopenMutation.isPending ? '...' : 'Rouvrir'}
                    </Button>
                  )}

                  {/* Générer facture & Transformer en devis — ONLY when Terminée AND NOT technicien */}
                  {(selectedIntervention.fk_statut === 3 || selectedIntervention.fk_statut === 5) && role !== 'technicien' && (
                    <>
                      <Button onClick={() => openFactureDialog(selectedIntervention)} disabled={createFactureMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Receipt className="h-4 w-4" /> Générer une facture
                      </Button>
                      <Button onClick={() => handleTransformDevis(selectedIntervention)} disabled={createDevisMutation.isPending} variant="outline" className="gap-2">
                        <ArrowRightLeft className="h-4 w-4" /> Transformer en Devis
                      </Button>
                    </>
                  )}

                  {/* PDF — only available when not brouillon */}
                  {selectedIntervention.fk_statut > 0 && (
                    <Button onClick={handleViewPDF} disabled={generatingPDF} variant="outline" className="gap-2">
                      <FileDown className="h-4 w-4" /> {generatingPDF ? 'Génération...' : 'Voir le PDF'}
                    </Button>
                  )}
                  {selectedIntervention.fk_statut > 0 && (
                    <Button
                      onClick={() => {
                        if (!selectedIntervention) return;
                        const client = clients.find(c => c.id === selectedIntervention.socid);
                        generateInterventionPdfLocal({
                          intervention: selectedIntervention,
                          client,
                          lines: interventionLines,
                          entreprise: config.entreprise,
                          signatureClient: signatureData || undefined,
                          signatureTech: signatureTechData || undefined,
                        });
                      }}
                      disabled={generatingPDF}
                      variant="outline" className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Télécharger le PDF
                    </Button>
                  )}
                  {/* Email — only when terminée (bon d'intervention complet) */}
                  {selectedIntervention.fk_statut >= 3 && role !== 'technicien' && (
                    <Button onClick={() => {
                      const c = clients.find(cl => cl.id === selectedIntervention.socid);
                      const defaultSubject = `Électricien du Genevois - Bon d'intervention ${selectedIntervention.ref}`;
                      const defaultMessage = `Bonjour,\n\nVous trouverez ci-joint votre bon d'intervention ${selectedIntervention.ref} terminé.\n\nCordialement,\nÉlectricien du Genevois`;
                      setEmailDest(c?.email || '');
                      setEmailObjet(defaultSubject);
                      setEmailMessage(defaultMessage);
                      setEmailOpen(true);
                    }} variant="outline" className="gap-2">
                      <Send className="h-4 w-4" /> Envoyer par email
                    </Button>
                  )}
                </div>

                {/* Email dialog */}
                <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Envoyer par email</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      {!config.smtp.user && (
                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                          ⚠️ SMTP non configuré — rendez-vous dans <strong>Configuration → Serveur mail</strong> pour activer l'envoi.
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Destinataire <span className="text-destructive">*</span></label>
                        <Input value={emailDest} onChange={e => setEmailDest(e.target.value)} type="email" placeholder="client@exemple.fr" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Objet</label>
                        <Input value={emailObjet} onChange={e => setEmailObjet(e.target.value)} placeholder="Bon d'intervention..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Message</label>
                        <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="min-h-[120px]" placeholder="Corps du message..." />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Le bon d'intervention PDF sera envoyé en pièce jointe.
                      </p>
                      <Button
                        onClick={() => {
                          if (!config.smtp.user || !config.smtp.pass) {
                            toast.error('SMTP non configuré. Allez dans Configuration → Serveur mail.');
                            return;
                          }
                          handleSendEmail();
                        }}
                        disabled={sendingEmail || !emailDest.trim()}
                        className="w-full"
                      >
                        {sendingEmail ? 'Envoi en cours...' : 'Envoyer avec le PDF'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* P2: Facture conversion dialog */}
      <Dialog open={factureDialogOpen} onOpenChange={setFactureDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Générer une facture depuis l'intervention</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Intervention : <span className="font-medium text-foreground">{factureIntervention?.ref}</span> — {factureIntervention?.client}
            </p>

            {factureLines.map((line, idx) => (
              <div key={idx} className="space-y-2 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</span>
                  {factureLines.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFactureLines(factureLines.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <Input placeholder="Description" value={line.desc} onChange={e => {
                  const nl = [...factureLines]; nl[idx] = { ...nl[idx], desc: e.target.value }; setFactureLines(nl);
                }} />
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Qté</label>
                    <Input type="number" min={0.01} step={0.01} value={line.qty} onChange={e => {
                      const nl = [...factureLines]; nl[idx] = { ...nl[idx], qty: parseFloat(e.target.value) || 1 }; setFactureLines(nl);
                    }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Prix HT</label>
                    <Input type="number" min={0} step={0.01} value={line.subprice} onChange={e => {
                      const nl = [...factureLines]; nl[idx] = { ...nl[idx], subprice: parseFloat(e.target.value) || 0 }; setFactureLines(nl);
                    }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">TVA %</label>
                    <Input type="number" min={0} value={line.tva_tx} onChange={e => {
                      const nl = [...factureLines]; nl[idx] = { ...nl[idx], tva_tx: parseFloat(e.target.value) || 0 }; setFactureLines(nl);
                    }} />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={() => setFactureLines([...factureLines, { desc: '', qty: 1, subprice: 0, tva_tx: 20 }])} className="gap-1">
              <Plus className="h-3 w-3" /> Ajouter une ligne
            </Button>

            <div className="text-sm font-medium text-foreground text-right">
              Total HT : {factureLines.reduce((sum, l) => sum + l.qty * l.subprice, 0).toFixed(2)} €
            </div>

            <Button onClick={handleCreateFactureFromLines} disabled={createFactureMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12">
              {createFactureMutation.isPending ? 'Création...' : 'Créer la facture'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit draft dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier l'intervention (Brouillon)</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={editType} onValueChange={(v) => setEditType(v as InterventionType)}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={editTech} onValueChange={setEditTech}>
              <SelectTrigger><SelectValue placeholder="Technicien" /></SelectTrigger>
              <SelectContent>
                {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Début</label>
                <Input type="time" value={editHeureDebut} onChange={(e) => setEditHeureDebut(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fin</label>
                <Input type="time" value={editHeureFin} onChange={(e) => setEditHeureFin(e.target.value)} />
              </div>
            </div>
            <Textarea placeholder="Description technique" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[80px]" />
            {role === 'admin' && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" /> Note privée (admin)
                </h3>
                <Textarea placeholder="Note privée..." value={editNotePrivee} onChange={(e) => setEditNotePrivee(e.target.value)} className="min-h-[60px]" />
              </div>
            )}
            <Button onClick={handleEditSave} disabled={updateMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CollisionAlert open={collisionOpen} onClose={() => setCollisionOpen(false)} technicien={collisionInfo.technicien} creneauExistant={collisionInfo.creneauExistant} />

      {/* PDF Preview */}
      <Dialog open={pdfPreviewOpen} onOpenChange={(open) => { setPdfPreviewOpen(open); if (!open && pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Aperçu PDF — {selectedIntervention?.ref}</DialogTitle></DialogHeader>
          <div className="flex-1 min-h-0">
            {pdfPreviewUrl ? (
              <iframe src={pdfPreviewUrl} className="w-full h-full rounded-md border border-border" title="Aperçu PDF" />
            ) : (
              <p className="text-muted-foreground text-center py-8">Chargement...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
