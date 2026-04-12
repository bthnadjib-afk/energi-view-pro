import { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useInterventions, useClients, useCreateIntervention, useCreateDevis, useCreateFacture, useValidateIntervention, useDeleteIntervention, useCloseIntervention, useDolibarrUsers, useSaveSignatures, useUpdateIntervention, useDevis, useFactures } from '@/hooks/useDolibarr';
import { statutsIntervention, typesIntervention, formatDateFR, generatePDF, openPDFInNewTab, downloadPDFUrl, sendInterventionByEmail, resolveTechnicianName, type InterventionType, type Intervention } from '@/services/dolibarr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CollisionAlert, checkCollision, type InterventionSlot } from '@/components/CollisionAlert';
import { SignaturePad } from '@/components/SignaturePad';
import { Plus, FileText, Receipt, Clock, ArrowRightLeft, Lock, FileDown, FileCheck, Trash2, Send, Play, CheckCircle2, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const typeLabels: Record<InterventionType, string> = {
  devis_sur_place: 'Devis sur place',
  panne: 'Panne',
  sav: 'SAV',
  chantier: 'Chantier',
  realisation: 'Réalisation',
};

const typeColors: Record<InterventionType, string> = {
  devis_sur_place: 'bg-blue-100 text-blue-700 border-blue-200',
  panne: 'bg-red-100 text-red-700 border-red-200',
  sav: 'bg-orange-100 text-orange-700 border-orange-200',
  chantier: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  realisation: 'bg-violet-100 text-violet-700 border-violet-200',
};

export default function Interventions() {
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [] } = useClients();
  const { data: dolibarrUsers = [] } = useDolibarrUsers();
  const { data: allDevis = [] } = useDevis();
  const { data: allFactures = [] } = useFactures();
  const createInterventionMutation = useCreateIntervention();
  const createDevisMutation = useCreateDevis();
  const createFactureMutation = useCreateFacture();
  const validateMutation = useValidateIntervention();
  const deleteMutation = useDeleteIntervention();
  const closeMutation = useCloseIntervention();
  const saveSignaturesMutation = useSaveSignatures();
  const updateMutation = useUpdateIntervention();
  const { role } = useAuth();

  // Cross-reference: find linked devis/factures per intervention
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
  const [editType, setEditType] = useState<InterventionType>('chantier');
  const [editNotePrivee, setEditNotePrivee] = useState('');

  const [newTech, setNewTech] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newHeureDebut, setNewHeureDebut] = useState('08:00');
  const [newHeureFin, setNewHeureFin] = useState('10:00');
  const [newType, setNewType] = useState<InterventionType>('chantier');
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

  // Resolve technician names from user_author_id
  const resolvedInterventions = interventions.map(i => {
    const techName = i.technicien || resolveTechnicianName(i.user_author_id, dolibarrUsers);
    return { ...i, technicien: techName };
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

  const handleCreate = async () => {
    if (!newClientId || !newDate) {
      toast.error('Veuillez remplir client et date');
      return;
    }

    const slots: InterventionSlot[] = resolvedInterventions.map(i => ({
      technicien: i.technicien,
      date: i.date,
      heureDebut: i.heureDebut,
      heureFin: i.heureFin,
      ref: i.ref,
    }));

    const collision = checkCollision(
      { technicien: newTech, date: newDate, heureDebut: newHeureDebut, heureFin: newHeureFin },
      slots
    );

    if (collision) {
      setCollisionInfo({
        technicien: newTech,
        creneauExistant: `${collision.ref || 'Intervention'} — ${collision.date} de ${collision.heureDebut} à ${collision.heureFin}`,
      });
      setCollisionOpen(true);
      return;
    }

    const selectedUser = dolibarrUsers.find(u => u.fullname === newTech);
    
    await createInterventionMutation.mutateAsync({
      socid: newClientId,
      description: newDescription || ' ',
      date: newDate,
      heureDebut: newHeureDebut,
      heureFin: newHeureFin,
      fk_user_assign: selectedUser?.id,
      type: newType,
      note_private: notePrivee || undefined,
    });
    setDialogOpen(false);
    setNewClientId(''); setNewDescription(''); setNewDate(''); setNewTech(''); setNotePrivee('');
  };

  const openDetail = (inter: Intervention) => {
    setSelectedIntervention(inter);
    setDetailOpen(true);
  };

  // Fix P2: pass intervention as param instead of depending on selectedIntervention state
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

  const handleTransformFacture = async (inter: Intervention) => {
    const socid = inter.socid;
    if (!socid) { toast.error('Client non identifié'); return; }
    const notePrivate = JSON.stringify({ from_intervention: inter.ref, intervention_id: inter.id });
    await createFactureMutation.mutateAsync({
      socid,
      lines: [{ desc: `Intervention ${inter.ref} — ${inter.description || 'Prestation'}`, qty: 1, subprice: 0, tva_tx: 20, product_type: 1 }],
      note_private: notePrivate,
    });
    toast.success('Facture créée depuis l\'intervention');
  };

  const handleViewPDF = async () => {
    if (!selectedIntervention) return;
    try {
      const url = await generatePDF('ficheinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      if (url) {
        openPDFInNewTab(url, `${selectedIntervention.ref}.pdf`);
        toast.success(`PDF ${selectedIntervention.ref} téléchargé`);
      } else {
        const dlUrl = await downloadPDFUrl('ficheinter', selectedIntervention.ref);
        if (dlUrl) openPDFInNewTab(dlUrl, `${selectedIntervention.ref}.pdf`);
        else toast.error('PDF non disponible');
      }
    } catch (e: any) {
      toast.error(`Erreur PDF : ${e.message || e}`);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedIntervention || !emailDest || !emailObjet) return;
    setSendingEmail(true);
    try {
      await generatePDF('ficheinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      await sendInterventionByEmail(selectedIntervention.id, emailDest, emailObjet, emailMessage);
      toast.success('Bon d\'intervention envoyé par email via Dolibarr');
    } catch (e: any) {
      toast.error(`Erreur envoi : ${e.message || e}`);
    }
    setSendingEmail(false);
    setEmailOpen(false);
  };

  // Edit draft handler
  const openEditDraft = () => {
    if (!selectedIntervention) return;
    setEditDescription(selectedIntervention.description || '');
    setEditTech(selectedIntervention.technicien || '');
    setEditDate(selectedIntervention.date || '');
    setEditHeureDebut(selectedIntervention.heureDebut || '08:00');
    setEditHeureFin(selectedIntervention.heureFin || '10:00');
    setEditType(selectedIntervention.type || 'chantier');
    setEditNotePrivee(selectedIntervention.compteRendu || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedIntervention) return;
    const selectedUser = dolibarrUsers.find(u => u.fullname === editTech);
    const dateTimestamp = editDate ? Math.floor(new Date(`${editDate}T12:00:00`).getTime() / 1000) : undefined;
    
    // Serialize metadata into note_private as JSON
    const metadata = JSON.stringify({
      type: editType || 'chantier',
      technicien: selectedUser?.id || editTech || '',
      heureDebut: editHeureDebut || '08:00',
      heureFin: editHeureFin || '10:00',
      notePrivee: editNotePrivee || '',
    });
    
    await updateMutation.mutateAsync({
      id: selectedIntervention.id,
      description: editDescription || ' ',
      fk_user_assign: selectedUser?.id,
      dateo: dateTimestamp,
      datee: dateTimestamp,
      note_private: metadata,
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Nouvelle intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle intervention (Brouillon)</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par réf, client, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
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
                        {/* Linked document badges */}
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Générer facture" onClick={() => handleTransformFacture(i)}>
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

                {/* Signatures */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">✅ Signatures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Signature du client</p>
                      <SignaturePad onSave={async (data) => {
                        setSignatureData(data);
                        if (selectedIntervention) {
                          await saveSignaturesMutation.mutateAsync({ id: selectedIntervention.id, signatureClient: data, signatureTech: signatureTechData || undefined });
                        }
                      }} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Signature du technicien</p>
                      <SignaturePad onSave={async (data) => {
                        setSignatureTechData(data);
                        if (selectedIntervention) {
                          await saveSignaturesMutation.mutateAsync({ id: selectedIntervention.id, signatureClient: signatureData || undefined, signatureTech: data });
                        }
                      }} />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {selectedIntervention.fk_statut === 0 && (
                    <>
                      <Button onClick={openEditDraft} variant="outline" className="gap-2">
                        <Pencil className="h-4 w-4" /> Modifier
                      </Button>
                      <Button onClick={async () => { await validateMutation.mutateAsync(selectedIntervention.id); setDetailOpen(false); }} disabled={validateMutation.isPending} className="gap-2">
                        <FileCheck className="h-4 w-4" /> {validateMutation.isPending ? 'Validation...' : 'Valider'}
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

                  {selectedIntervention.fk_statut === 1 && (
                    <Button onClick={async () => { await closeMutation.mutateAsync({ id: selectedIntervention.id, status: 2 }); setDetailOpen(false); }} disabled={closeMutation.isPending} className="gap-2 bg-orange-500 hover:bg-orange-600">
                      <Play className="h-4 w-4" /> {closeMutation.isPending ? '...' : 'Démarrer (En cours)'}
                    </Button>
                  )}

                  {selectedIntervention.fk_statut === 2 && (
                    <Button onClick={async () => { await closeMutation.mutateAsync({ id: selectedIntervention.id, status: 3 }); setDetailOpen(false); }} disabled={closeMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> {closeMutation.isPending ? '...' : 'Terminer'}
                    </Button>
                  )}

                  {selectedIntervention.fk_statut >= 1 && (
                    <Button onClick={() => handleTransformFacture(selectedIntervention)} disabled={createFactureMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <Receipt className="h-4 w-4" /> {createFactureMutation.isPending ? 'Création...' : 'Générer une facture'}
                    </Button>
                  )}

                  <Button onClick={() => handleTransformDevis(selectedIntervention)} disabled={createDevisMutation.isPending} variant="outline" className="gap-2">
                    <ArrowRightLeft className="h-4 w-4" /> {createDevisMutation.isPending ? 'Création...' : 'Transformer en Devis'}
                  </Button>

                  <Button onClick={handleViewPDF} variant="outline" className="gap-2">
                    <FileDown className="h-4 w-4" /> Voir le PDF
                  </Button>
                  <Button onClick={() => {
                    const c = clients.find(cl => cl.id === selectedIntervention.socid);
                    setEmailDest(c?.email || '');
                    setEmailObjet(`Bon d'intervention ${selectedIntervention.ref}`);
                    setEmailMessage('');
                    setEmailOpen(true);
                  }} variant="outline" className="gap-2">
                    <Send className="h-4 w-4" /> Envoyer par email
                  </Button>
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
                        {sendingEmail ? 'Envoi via Dolibarr...' : 'Envoyer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
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

      <CollisionAlert
        open={collisionOpen}
        onClose={() => setCollisionOpen(false)}
        technicien={collisionInfo.technicien}
        creneauExistant={collisionInfo.creneauExistant}
      />
    </div>
  );
}
