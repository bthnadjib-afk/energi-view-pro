import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useInterventions, useClients, useCreateIntervention, useCreateDevis, useCreateFacture, useValidateIntervention, useDeleteIntervention } from '@/hooks/useDolibarr';
import { techniciens, statutsIntervention, typesIntervention, formatDateFR, generatePDF, downloadPDFUrl, sendInterventionByEmail, type InterventionType, type Intervention, type InterventionStatut } from '@/services/dolibarr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CollisionAlert, checkCollision, type InterventionSlot } from '@/components/CollisionAlert';
import { SignaturePad } from '@/components/SignaturePad';
import { Plus, FileText, Receipt, Camera, Clock, ArrowRightLeft, Lock, FileDown, FileCheck, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const typeLabels: Record<InterventionType, string> = {
  devis_sur_place: 'Devis sur place',
  panne: 'Panne',
  sav: 'SAV',
  chantier: 'Chantier',
  realisation: 'Réalisation',
};

const typeColors: Record<InterventionType, string> = {
  devis_sur_place: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  panne: 'bg-red-500/20 text-red-400 border-red-500/30',
  sav: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  chantier: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  realisation: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

export default function Interventions() {
  const { data: interventions = [] } = useInterventions();
  const { data: clients = [] } = useClients();
  const createInterventionMutation = useCreateIntervention();
  const createDevisMutation = useCreateDevis();
  const createFactureMutation = useCreateFacture();
  const validateMutation = useValidateIntervention();
  const deleteMutation = useDeleteIntervention();
  const { role, user } = useAuth();
  const [techFilter, setTechFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  // New intervention form
  const [newTech, setNewTech] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newHeureDebut, setNewHeureDebut] = useState('08:00');
  const [newHeureFin, setNewHeureFin] = useState('10:00');
  const [newType, setNewType] = useState<InterventionType>('chantier');
  const [newDescription, setNewDescription] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [descriptionClient, setDescriptionClient] = useState('');
  const [compteRendu, setCompteRendu] = useState('');
  const [notePrivee, setNotePrivee] = useState('');

  // Anti-collision
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionInfo, setCollisionInfo] = useState({ technicien: '', creneauExistant: '' });

  // Email
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDest, setEmailDest] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Signatures
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureTechData, setSignatureTechData] = useState<string | null>(null);

  const filtered = interventions.filter((i) => {
    if (techFilter !== 'all' && i.technicien !== techFilter) return false;
    if (statutFilter !== 'all' && i.statut !== statutFilter) return false;
    if (typeFilter !== 'all' && i.type !== typeFilter) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!newClientId || !newDescription || !newDate) {
      toast.error('Veuillez remplir client, description et date');
      return;
    }

    const slots: InterventionSlot[] = interventions.map(i => ({
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

    await createInterventionMutation.mutateAsync({
      socid: newClientId,
      description: newDescription,
      date: newDate,
    });
    setDialogOpen(false);
    setNewClientId(''); setNewDescription(''); setNewDate(''); setNewTech(''); setNotePrivee(''); setDescriptionClient(''); setCompteRendu('');
  };

  const openDetail = (inter: Intervention) => {
    setSelectedIntervention(inter);
    setDetailOpen(true);
  };

  const handleTransformDevis = async () => {
    if (!selectedIntervention) return;
    const socid = selectedIntervention.socid;
    if (!socid) { toast.error('Client non identifié'); return; }
    await createDevisMutation.mutateAsync({
      socid,
      lines: [{ desc: selectedIntervention.description, qty: 1, subprice: 0, tva_tx: 0, product_type: 1 }],
    });
    toast.success('Devis créé à partir de l\'intervention');
  };

  const handleTransformFacture = async () => {
    if (!selectedIntervention) return;
    const socid = selectedIntervention.socid;
    if (!socid) { toast.error('Client non identifié'); return; }
    await createFactureMutation.mutateAsync({
      socid,
      lines: [{ desc: selectedIntervention.description, qty: 1, subprice: 0, tva_tx: 20, product_type: 1 }],
    });
    toast.success('Facture créée à partir de l\'intervention');
  };

  const handleViewPDF = async () => {
    if (!selectedIntervention) return;
    try {
      await generatePDF('ficheinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      const url = await downloadPDFUrl('ficheinter', selectedIntervention.ref);
      if (url) {
        window.open(url, '_blank');
        toast.success(`Bon d'intervention ${selectedIntervention.ref} ouvert`);
      } else {
        toast.success(`Bon d'intervention ${selectedIntervention.ref} généré`);
      }
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const handleSendEmail = async () => {
    if (!selectedIntervention || !emailDest || !emailObjet) return;
    setSendingEmail(true);
    try {
      await generatePDF('ficheinter', selectedIntervention.id, selectedIntervention.ref, 'soleil');
      await sendInterventionByEmail(selectedIntervention.id, emailDest, emailObjet, emailMessage);
      await supabase.from('email_history').insert({
        user_id: user?.id || '',
        client_id: selectedIntervention.socid || '',
        document_ref: selectedIntervention.ref,
        destinataire: emailDest,
        objet: emailObjet,
        message: emailMessage,
      });
      toast.success('Bon d\'intervention envoyé par email');
    } catch (e: any) {
      await supabase.from('email_history').insert({
        user_id: user?.id || '',
        client_id: selectedIntervention.socid || '',
        document_ref: selectedIntervention.ref,
        destinataire: emailDest,
        objet: emailObjet,
        message: emailMessage,
      });
      toast.warning('Email enregistré localement — l\'envoi Dolibarr a échoué');
    }
    setSendingEmail(false);
    setEmailOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interventions</h1>
          <p className="text-muted-foreground text-sm">Planning et suivi des interventions terrain</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 border-0 h-12 px-6 text-base">
              <Plus className="h-4 w-4" /> Nouvelle intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Nouvelle intervention</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newType} onValueChange={(v) => setNewType(v as InterventionType)}>
                <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newTech} onValueChange={setNewTech}>
                <SelectTrigger className="glass border-border/50"><SelectValue placeholder="Technicien" /></SelectTrigger>
                <SelectContent>
                  {techniciens.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="glass border-border/50" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Début</label>
                  <Input type="time" value={newHeureDebut} onChange={(e) => setNewHeureDebut(e.target.value)} className="glass border-border/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fin</label>
                  <Input type="time" value={newHeureFin} onChange={(e) => setNewHeureFin(e.target.value)} className="glass border-border/50" />
                </div>
              </div>
              <Input placeholder="Description technique" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="glass border-border/50" />

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">📋 Description Client</h3>
                <Textarea placeholder="Description visible par le client (devis, bon d'intervention)..." value={descriptionClient} onChange={(e) => setDescriptionClient(e.target.value)} className="glass border-border/50 min-h-[60px]" />
              </div>

              {role === 'admin' && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Note privée (admin)
                  </h3>
                  <Textarea
                    placeholder="Note visible uniquement par les administrateurs..."
                    value={notePrivee}
                    onChange={(e) => setNotePrivee(e.target.value)}
                    className="glass border-border/50 min-h-[60px]"
                  />
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={createInterventionMutation.isPending}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 border-0 h-12 text-base"
              >
                {createInterventionMutation.isPending ? 'Création...' : "Créer l'intervention"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-full sm:w-[220px] glass border-border/50"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {techniciens.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-[180px] glass border-border/50"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statutsIntervention.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px] glass border-border/50"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typesIntervention.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
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
                  <tr key={i.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => openDetail(i)}>
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
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {i.statut === 'terminé' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Générer facture" onClick={() => { setSelectedIntervention(i); handleTransformFacture(); }}>
                            <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                          </Button>
                        )}
                        {(i.statut === 'brouillon' || i.statut === 'validé' || i.statut === 'en cours') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Transformer en Devis" onClick={() => { setSelectedIntervention(i); handleTransformDevis(); }}>
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
        <DialogContent className="glass-strong border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIntervention && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  {selectedIntervention.ref}
                  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs ml-2', typeColors[selectedIntervention.type])}>
                    {typeLabels[selectedIntervention.type]}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Client :</span> <span className="text-foreground ml-1">{selectedIntervention.client}</span></div>
                  <div><span className="text-muted-foreground">Technicien :</span> <span className="text-foreground ml-1">{selectedIntervention.technicien || '—'}</span></div>
                  <div><span className="text-muted-foreground">Date :</span> <span className="text-foreground ml-1">{formatDateFR(selectedIntervention.date)}</span></div>
                  <div><span className="text-muted-foreground">Horaire :</span> <span className="text-foreground ml-1">{selectedIntervention.heureDebut} – {selectedIntervention.heureFin}</span></div>
                </div>

                {/* Description Client */}
                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground font-medium">Description Client :</span>
                  <p className="text-foreground bg-accent/10 p-2 rounded">{selectedIntervention.descriptionClient || selectedIntervention.description || '—'}</p>
                </div>

                {/* Compte-rendu Technique */}
                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground font-medium">Compte-rendu Technique :</span>
                  <Textarea
                    placeholder="Compte-rendu technique (visible en interne)..."
                    defaultValue={selectedIntervention.compteRendu || ''}
                    className="glass border-border/50 min-h-[60px] text-sm"
                  />
                </div>

                {/* Notes privées (admin only) */}
                {role === 'admin' && (
                  <div className="space-y-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-orange-400" /> Note privée (admin)
                    </h3>
                    <Textarea
                      placeholder="Ajouter une note privée..."
                      defaultValue={selectedIntervention.notePrivee || ''}
                      className="glass border-border/50 min-h-[60px] text-sm"
                    />
                  </div>
                )}

                {/* Section Pendant */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">📸 Pendant l'intervention</h3>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer glass rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Camera className="h-4 w-4" /> Ajouter une photo depuis le mobile
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => toast.success('Photo ajoutée (mode démo)')} />
                    </label>
                  </div>
                </div>

                {/* Section Après */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">✅ Fin d'intervention</h3>
                  <Input placeholder="Note de fin de chantier..." className="glass border-border/50" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Signature du client</p>
                      <SignaturePad onSave={(data) => { setSignatureData(data); toast.success('Signature client enregistrée'); }} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Signature du technicien</p>
                      <SignaturePad onSave={(data) => { setSignatureTechData(data); toast.success('Signature technicien enregistrée'); }} />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {selectedIntervention.statut === 'terminé' && (
                    <Button
                      onClick={handleTransformFacture}
                      disabled={createFactureMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 border-0 h-12 px-6 text-base"
                    >
                      <Receipt className="h-4 w-4" />
                      {createFactureMutation.isPending ? 'Création...' : 'Générer une facture'}
                    </Button>
                  )}
                  {(selectedIntervention.statut === 'brouillon' || selectedIntervention.statut === 'validé' || selectedIntervention.statut === 'en cours') && (
                    <Button
                      onClick={handleTransformDevis}
                      disabled={createDevisMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 border-0 h-12 px-6 text-base"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      {createDevisMutation.isPending ? 'Création...' : 'Transformer en Devis'}
                    </Button>
                  )}
                  <Button onClick={handleViewPDF} variant="outline" className="gap-2 glass border-border/50 h-12 px-6 text-base">
                    <FileDown className="h-4 w-4" /> Voir le PDF
                  </Button>
                </div>
              </div>
            </>
          )}
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
