import { useState, useMemo, useEffect } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import {
  useInterventions, useClients, useCreateIntervention, useCreateDevis, useCreateFacture,
  useValidateIntervention, useDeleteIntervention, useCloseIntervention, useSetInterventionStatus,
  useDolibarrUsers, useSaveSignatures, useUpdateIntervention, useDevis, useFactures,
  useCreateClient, useGenerateInterventionPDF, useReopenIntervention, useProduits,
  useInterventionLines, useAddInterventionLine, useUpdateInterventionLine, useDeleteInterventionLine,
} from '@/hooks/useDolibarr';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import {
  statutsIntervention, typesIntervention, formatDateFR, generatePDF, openPDFInNewTab,
  downloadPDFUrl, sendInterventionByEmail, resolveTechnicianName, getInterventionSignatures,
  type InterventionType, type Intervention, type InterventionLine,
} from '@/services/dolibarr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CollisionAlert, checkCollision, type InterventionSlot } from '@/components/CollisionAlert';
import { SignaturePad } from '@/components/SignaturePad';
import { Plus, FileText, Receipt, Clock, ArrowRightLeft, Lock, FileDown, FileCheck, Trash2, Send, Play, CheckCircle2, Search, Pencil, RefreshCw, XCircle, RotateCcw, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const { data: allDevis = [] } = useDevis();
  const { data: allFactures = [] } = useFactures();
  const { data: produits = [] } = useProduits();
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
  const generatePDFMutation = useGenerateInterventionPDF();
  const reopenMutation = useReopenIntervention();
  const addLineMutation = useAddInterventionLine();
  const updateLineMutation = useUpdateInterventionLine();
  const deleteLineMutation = useDeleteInterventionLine();
  const { role } = useAuth();

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
  const [newType, setNewType] = useState<InterventionType>('devis');
  const [newDescription, setNewDescription] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [notePrivee, setNotePrivee] = useState('');

  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionInfo, setCollisionInfo] = useState({ technicien: '', creneauExistant: '' });

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureTechData, setSignatureTechData] = useState<string | null>(null);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // P1: Lines state
  const { data: interventionLines = [], refetch: refetchLines } = useInterventionLines(selectedIntervention?.id);
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineDesc, setLineDesc] = useState('');
  const [lineDate, setLineDate] = useState('');
  const [lineDuree, setLineDuree] = useState(60); // minutes

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

    if (!clientId || !newDate) { toast.error('Veuillez remplir client et date'); return; }
    if (!newDescription.trim()) { toast.error('La description est obligatoire'); return; }

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
      fk_user_assign: selectedUser?.id, type: newType, note_private: notePrivee || undefined,
    });
    setDialogOpen(false);
    setNewClientId(''); setNewDescription(''); setNewDate(''); setNewTech(''); setNotePrivee(''); setNewType('devis');
    resetNewClientForm();
  };

  const openDetail = (inter: Intervention) => {
    setSelectedIntervention(inter);
    setDetailOpen(true);
    setShowAddLine(false);
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
      let url = await generatePDF('fichinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      if (!url) url = await downloadPDFUrl('fichinter', selectedIntervention.ref);
      if (url) { setPdfPreviewUrl(url); setPdfPreviewOpen(true); }
      else toast.error('PDF non disponible');
    } catch (e: any) { toast.error(`Erreur PDF : ${e.message || e}`); }
    finally { setGeneratingPDF(false); }
  };

  const handleSendEmail = async () => {
    if (!selectedIntervention || !emailDest || !emailObjet) return;
    setSendingEmail(true);
    try {
      await generatePDF('fichinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      await sendInterventionByEmail(selectedIntervention.id, emailDest, emailObjet, emailMessage);
      toast.success('Bon d\'intervention envoyé par email');
    } catch (e: any) { toast.error(`Erreur envoi : ${e.message || e}`); }
    setSendingEmail(false);
    setEmailOpen(false);
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

  // P1: Add line handler
  const handleAddLine = async () => {
    if (!selectedIntervention || !lineDesc.trim()) { toast.error('Description requise'); return; }
    await addLineMutation.mutateAsync({
      interventionId: selectedIntervention.id,
      description: lineDesc,
      date: lineDate || selectedIntervention.date,
      duree: lineDuree * 60, // convert minutes to seconds
    });
    setLineDesc(''); setLineDate(''); setLineDuree(60); setShowAddLine(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interventions</h1>
          <p className="text-muted-foreground text-sm">Planning et suivi — statuts natifs Dolibarr</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Nouvelle intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle intervention (Brouillon)</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {!showNewClientForm ? (
                <Select value={newClientId} onValueChange={(v) => { if (v === '__new__') { setShowNewClientForm(true); setNewClientId(''); } else { setNewClientId(v); } }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                    <SelectItem value="__new__" className="text-primary font-medium">＋ Nouveau client</SelectItem>
                  </SelectContent>
                </Select>
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
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newTech} onValueChange={setNewTech}>
                <SelectTrigger><SelectValue placeholder="Technicien (Dolibarr)" /></SelectTrigger>
                <SelectContent>
                  {technicienNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  {technicienNames.length === 0 && <SelectItem value="none" disabled>Aucun utilisateur Dolibarr</SelectItem>}
                </SelectContent>
              </Select>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Début</label>
                  <Input type="time" value={newHeureDebut} onChange={(e) => setNewHeureDebut(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fin</label>
                  <Input type="time" value={newHeureFin} onChange={(e) => setNewHeureFin(e.target.value)} />
                </div>
              </div>
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
                    <td className="py-3 px-2"><StatusBadge statut={i.statut} /></td>
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
                        {i.fk_statut >= 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Générer facture" onClick={() => openFactureDialog(i)}>
                            <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Transformer en Devis" onClick={() => handleTransformDevis(i)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
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
                  <StatusBadge statut={selectedIntervention.statut} />
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

                {/* P1: Intervention Lines */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ListPlus className="h-4 w-4" /> Lignes d'intervention ({interventionLines.length})
                    </h3>
                    {selectedIntervention.fk_statut <= 1 && (
                      <Button variant="outline" size="sm" onClick={() => { setShowAddLine(true); setLineDate(selectedIntervention.date); }} className="gap-1 text-xs">
                        <Plus className="h-3 w-3" /> Ajouter
                      </Button>
                    )}
                  </div>

                  {interventionLines.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left py-2 px-3 text-muted-foreground">Description</th>
                            <th className="text-left py-2 px-3 text-muted-foreground">Date</th>
                            <th className="text-left py-2 px-3 text-muted-foreground">Durée</th>
                            {selectedIntervention.fk_statut <= 1 && <th className="py-2 px-3 w-16"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {interventionLines.map((line) => (
                            <tr key={line.id} className="border-t border-border/50">
                              <td className="py-2 px-3 text-foreground">{line.description}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDateFR(line.date)}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDuration(line.duree)}</td>
                              {selectedIntervention.fk_statut <= 1 && (
                                <td className="py-2 px-3">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLineMutation.mutate({ interventionId: selectedIntervention.id, lineId: line.id })}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {interventionLines.length === 0 && !showAddLine && (
                    <p className="text-xs text-muted-foreground italic">Aucune ligne — ajoutez des détails pour enrichir le PDF.</p>
                  )}

                  {showAddLine && (
                    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/20">
                      <Input placeholder="Description de la ligne *" value={lineDesc} onChange={e => setLineDesc(e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Date</label>
                          <Input type="date" value={lineDate} onChange={e => setLineDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Durée (minutes)</label>
                          <Input type="number" min={1} value={lineDuree} onChange={e => setLineDuree(parseInt(e.target.value) || 60)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddLine} disabled={addLineMutation.isPending}>
                          {addLineMutation.isPending ? 'Ajout...' : 'Ajouter la ligne'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddLine(false)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Signatures - only when validated (fk_statut >= 1) */}
                {selectedIntervention.fk_statut >= 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">✅ Signatures</h3>
                    {/* Show saved signatures */}
                    {(signatureData || signatureTechData) && (
                      <div className="grid grid-cols-2 gap-4">
                        {signatureData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Signature client (enregistrée)</p>
                            <img src={signatureData} alt="Signature client" className="border border-border rounded max-h-20" />
                          </div>
                        )}
                        {signatureTechData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Signature technicien (enregistrée)</p>
                            <img src={signatureTechData} alt="Signature technicien" className="border border-border rounded max-h-20" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Signature du client</p>
                        <SignaturePad onSave={async (data) => {
                          setSignatureData(data);
                          if (selectedIntervention) {
                            await saveSignaturesMutation.mutateAsync({ id: selectedIntervention.id, signatureClient: data, signatureTech: signatureTechData || undefined, ref: selectedIntervention.ref });
                          }
                        }} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Signature du technicien</p>
                        <SignaturePad onSave={async (data) => {
                          setSignatureTechData(data);
                          if (selectedIntervention) {
                            await saveSignaturesMutation.mutateAsync({ id: selectedIntervention.id, signatureClient: signatureData || undefined, signatureTech: data, ref: selectedIntervention.ref });
                          }
                        }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {/* Brouillon (0) */}
                  {selectedIntervention.fk_statut === 0 && (
                    <>
                      <Button onClick={openEditDraft} variant="outline" className="gap-2">
                        <Pencil className="h-4 w-4" /> Modifier
                      </Button>
                      <Button onClick={async () => { await validateMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} disabled={validateMutation.isPending} className="gap-2">
                        <Play className="h-4 w-4" /> {validateMutation.isPending ? 'Validation...' : 'Valider'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="gap-2 border-destructive/30 text-destructive"><Trash2 className="h-4 w-4" /> Supprimer</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer {selectedIntervention.ref} ?</AlertDialogTitle>
                            <AlertDialogDescription>Suppression définitive.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { await deleteMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}

                  {/* Validée (1) → En cours */}
                  {selectedIntervention.fk_statut === 1 && (
                    <Button onClick={async () => { await statusMutation.mutateAsync({ id: selectedIntervention.id, status: 2 }); setDetailOpen(false); }} disabled={statusMutation.isPending} className="gap-2 bg-orange-500 hover:bg-orange-600">
                      <Play className="h-4 w-4" /> {statusMutation.isPending ? '...' : 'Démarrer (En cours)'}
                    </Button>
                  )}

                  {/* En cours (2) → Terminée */}
                  {selectedIntervention.fk_statut === 2 && (
                    <Button onClick={async () => { await statusMutation.mutateAsync({ id: selectedIntervention.id, status: 3 }); setDetailOpen(false); }} disabled={statusMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> {statusMutation.isPending ? '...' : 'Terminer'}
                    </Button>
                  )}

                  {/* P3: Terminée (3) → Fermée (5) */}
                  {selectedIntervention.fk_statut === 3 && (
                    <Button onClick={async () => { await closeMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} disabled={closeMutation.isPending} variant="outline" className="gap-2">
                      <XCircle className="h-4 w-4" /> {closeMutation.isPending ? '...' : 'Fermer l\'intervention'}
                    </Button>
                  )}

                  {/* P4: Fermée (5) → Rouvrir */}
                  {selectedIntervention.fk_statut === 5 && (
                    <Button onClick={async () => { await reopenMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} disabled={reopenMutation.isPending} className="gap-2">
                      <RotateCcw className="h-4 w-4" /> {reopenMutation.isPending ? '...' : 'Rouvrir'}
                    </Button>
                  )}

                  {/* Actions available for statut >= 1 */}
                  {selectedIntervention.fk_statut >= 1 && (
                    <>
                      <Button onClick={() => openFactureDialog(selectedIntervention)} disabled={createFactureMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Receipt className="h-4 w-4" /> Générer une facture
                      </Button>
                      <Button onClick={() => handleTransformDevis(selectedIntervention)} disabled={createDevisMutation.isPending} variant="outline" className="gap-2">
                        <ArrowRightLeft className="h-4 w-4" /> Transformer en Devis
                      </Button>
                    </>
                  )}

                  {/* PDF & Email — always available */}
                  <Button onClick={handleViewPDF} disabled={generatingPDF || generatePDFMutation.isPending} variant="outline" className="gap-2">
                    <FileDown className="h-4 w-4" /> {(generatingPDF || generatePDFMutation.isPending) ? 'Génération...' : 'Voir le PDF'}
                  </Button>
                  <Button
                    onClick={() => selectedIntervention?.ref && generatePDFMutation.mutate({ ref: selectedIntervention.ref })}
                    disabled={generatePDFMutation.isPending || generatingPDF}
                    variant="outline" className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", generatePDFMutation.isPending && "animate-spin")} />
                    {generatePDFMutation.isPending ? 'Génération du PDF...' : 'Générer le PDF'}
                  </Button>
                  {selectedIntervention.fk_statut >= 1 && (
                    <Button onClick={() => {
                      const c = clients.find(cl => cl.id === selectedIntervention.socid);
                      setEmailDest(c?.email || '');
                      setEmailObjet(`Bon d'intervention ${selectedIntervention.ref}`);
                      setEmailMessage('');
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
                      <Button onClick={handleSendEmail} disabled={sendingEmail || !emailDest} className="w-full">
                        {sendingEmail ? 'Envoi...' : 'Envoyer'}
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
