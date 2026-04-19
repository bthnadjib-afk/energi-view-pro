import { useState, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { testDolibarrConnection, purgeAllDevisAndFactures } from '@/services/dolibarr';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Input } from '@/components/ui/input';
import { formatPhone } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Building2, Settings2, Bell, Database, CheckCircle2, XCircle, Loader2, Save, Mail, Plus, Trash2, Edit2, AlertTriangle, UserCog, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import Utilisateurs from '@/pages/Utilisateurs';
import Preferences from '@/pages/Preferences';

interface EmailTemplate {
  id: string;
  nom: string;
  objet: string;
  corps: string;
}

export default function Configuration() {
  const { config, saving, updateEntreprise, updateDefaults, updateNotifications, updateDolibarr, updateSmtp, saveToSupabase } = useConfig();
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editObjet, setEditObjet] = useState('');
  const [editCorps, setEditCorps] = useState('');
  const [purging, setPurging] = useState(false);

  const handlePurgeAll = async () => {
    setPurging(true);
    try {
      const result = await purgeAllDevisAndFactures();
      // Nettoie aussi les tables de relances
      await Promise.all([
        supabase.from('devis_relances').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('facture_relances').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);
      queryClient.invalidateQueries();
      toast.success(
        `Purge terminée : ${result.devisDeleted} devis et ${result.facturesDeleted} factures supprimés` +
          (result.devisFailed + result.facturesFailed > 0
            ? ` (${result.devisFailed + result.facturesFailed} échecs)`
            : '')
      );
    } catch (e: any) {
      toast.error(`Échec de la purge : ${e.message || e}`);
    } finally {
      setPurging(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
      toast.error('Renseignez au minimum le serveur, l\'identifiant et le mot de passe SMTP');
      return;
    }
    setTestingSmtp(true);
    try {
      await saveToSupabase();
      const { data, error } = await supabase.functions.invoke('send-email-smtp', {
        body: {
          to: config.smtp.user,
          subject: 'Test SMTP — Électricien du Genevois',
          message: 'Ce message confirme que la configuration SMTP fonctionne correctement.',
          smtpHost: config.smtp.host,
          smtpPort: config.smtp.port || '465',
          smtpUser: config.smtp.user,
          smtpPass: config.smtp.pass,
        },
      });
      if (error) throw new Error(error.message);
      if (data && !data.ok) throw new Error(data.error || 'Échec SMTP');
      toast.success('Email de test envoyé avec succès !');
    } catch (e: any) {
      toast.error(`Échec SMTP : ${e.message || e}`);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const ok = await testDolibarrConnection();
      if (ok) {
        updateDolibarr({ connected: true });
        toast.success('Connexion Dolibarr réussie !');
      } else {
        updateDolibarr({ connected: false });
        toast.error('Échec de la connexion. Vérifiez vos paramètres.');
      }
    } catch {
      updateDolibarr({ connected: false });
      toast.error('Erreur lors du test de connexion');
    }
    setTesting(false);
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    const { data } = await supabase.from('email_templates').select('*').order('created_at', { ascending: true });
    if (data) setTemplates(data as any);
    setLoadingTemplates(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const startEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setEditNom(t.nom);
    setEditObjet(t.objet);
    setEditCorps(t.corps);
  };

  const startNew = () => {
    setEditingId('new');
    setEditNom('');
    setEditObjet('');
    setEditCorps('');
  };

  const saveTemplate = async () => {
    if (!editNom.trim()) return;
    if (editingId === 'new') {
      await supabase.from('email_templates').insert({ nom: editNom, objet: editObjet, corps: editCorps });
    } else {
      await supabase.from('email_templates').update({ nom: editNom, objet: editObjet, corps: editCorps }).eq('id', editingId!);
    }
    setEditingId(null);
    fetchTemplates();
    toast.success('Modèle sauvegardé');
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('email_templates').delete().eq('id', id);
    fetchTemplates();
    toast.success('Modèle supprimé');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
          <p className="text-muted-foreground text-sm">Paramètres de l'application</p>
        </div>
        <Button onClick={saveToSupabase} disabled={saving} className="gap-2 h-12 px-6 text-base">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder les paramètres
        </Button>
      </div>

      <Tabs defaultValue="entreprise" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="entreprise" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Entreprise</TabsTrigger>
          <TabsTrigger value="defaults" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Valeurs par défaut</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Modèles emails</TabsTrigger>
          <TabsTrigger value="smtp" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Serveur mail</TabsTrigger>
          <TabsTrigger value="dolibarr" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Dolibarr</TabsTrigger>
          <TabsTrigger value="utilisateurs" className="gap-1.5"><UserCog className="h-3.5 w-3.5" /> Utilisateurs</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Préférences</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="entreprise">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informations entreprise</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nom de l'entreprise</label>
                <Input value={config.entreprise.nom} onChange={(e) => updateEntreprise({ nom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">SIRET</label>
                <Input value={config.entreprise.siret} onChange={(e) => updateEntreprise({ siret: e.target.value })} placeholder="123 456 789 00001" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Adresse</label>
                <AddressAutocomplete value={config.entreprise.adresse} onSelect={(addr) => updateEntreprise({ adresse: addr.rue, codePostal: addr.codePostal, ville: addr.ville })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Téléphone</label>
                <Input value={config.entreprise.telephone} onChange={(e) => updateEntreprise({ telephone: formatPhone(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Email</label>
                <Input value={config.entreprise.email} onChange={(e) => updateEntreprise({ email: e.target.value })} type="email" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">TVA Intracommunautaire</label>
                <Input value={config.entreprise.tvaIntra ?? ''} onChange={(e) => updateEntreprise({ tvaIntra: e.target.value })} placeholder="FR00 123456789" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Capital social</label>
                <Input value={config.entreprise.capitalSocial ?? ''} onChange={(e) => updateEntreprise({ capitalSocial: e.target.value })} placeholder="10 000 €" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">RCS</label>
                <Input value={config.entreprise.rcs ?? ''} onChange={(e) => updateEntreprise({ rcs: e.target.value })} placeholder="RCS Annecy 123 456 789" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="defaults">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Valeurs par défaut</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Taux TVA (%)</label>
                <Input type="number" value={config.defaults.tauxTVA} onChange={(e) => updateDefaults({ tauxTVA: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Délai de paiement (jours)</label>
                <Input type="number" value={config.defaults.delaiPaiement} onChange={(e) => updateDefaults({ delaiPaiement: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Durée intervention par défaut (heures)</label>
                <Input type="number" value={config.defaults.dureeIntervention} onChange={(e) => updateDefaults({ dureeIntervention: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Taux horaire (€/h)</label>
                <Input type="number" value={config.defaults.tauxHoraire} onChange={(e) => updateDefaults({ tauxHoraire: Number(e.target.value) })} />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Acompte sur devis</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Taux d'acompte par défaut (%)</label>
                  <Input type="number" min={0} max={100} value={config.defaults.tauxAcompte ?? 30} onChange={(e) => updateDefaults({ tauxAcompte: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Seuil TTC (€) — 0 = désactivé</label>
                  <Input type="number" min={0} value={config.defaults.seuilAcompte ?? 0} onChange={(e) => updateDefaults({ seuilAcompte: Number(e.target.value) })} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Taux si TTC dépasse le seuil (%)</label>
                  <Input type="number" min={0} max={100} value={config.defaults.tauxAcompteSeuilDepasse ?? 50} onChange={(e) => updateDefaults({ tauxAcompteSeuilDepasse: Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ex : 30 % par défaut, puis 50 % si le devis dépasse 5 000 €</p>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Chantier — valeurs par défaut</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Heure début chantier</label>
                  <Input
                    type="time"
                    value={config.defaults.chantierHeureDebut}
                    onChange={(e) => updateDefaults({ chantierHeureDebut: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Heure fin chantier</label>
                  <Input
                    type="time"
                    value={config.defaults.chantierHeureFin}
                    onChange={(e) => updateDefaults({ chantierHeureFin: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Jours travaillés par défaut sur chantier</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: '1', l: 'Lun' }, { v: '2', l: 'Mar' }, { v: '3', l: 'Mer' },
                    { v: '4', l: 'Jeu' }, { v: '5', l: 'Ven' }, { v: '6', l: 'Sam' }, { v: '7', l: 'Dim' },
                  ].map(d => {
                    const active = (config.defaults.chantierJours || '').split(',').filter(Boolean).includes(d.v);
                    return (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => {
                          const cur = (config.defaults.chantierJours || '').split(',').filter(Boolean);
                          const next = active ? cur.filter(x => x !== d.v) : [...cur, d.v].sort();
                          updateDefaults({ chantierJours: next.join(',') });
                        }}
                        className={
                          active
                            ? 'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors bg-primary text-primary-foreground border-primary'
                            : 'px-3 py-1.5 rounded-md border text-sm font-medium transition-colors bg-card text-muted-foreground border-border hover:bg-muted'
                        }
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sélection appliquée par défaut quand on planifie un chantier sur plusieurs jours (ex: Lun, Mer, Ven).
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Notifications email</h2>
            <div className="space-y-4">
              {[
                { key: 'nouveauDevis' as const, label: 'Nouveau devis créé' },
                { key: 'interventionPlanifiee' as const, label: 'Intervention planifiée' },
                { key: 'factureEnRetard' as const, label: 'Facture en retard' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <Switch checked={config.notifications[item.key]} onCheckedChange={(v) => updateNotifications({ [item.key]: v })} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Modèles d'emails</h2>
              <Button onClick={startNew} className="gap-2" size="sm">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Variables disponibles : <code>[NOM_CLIENT]</code>, <code>[REF_DEVIS]</code>, <code>[REF_FACTURE]</code>, <code>[REF_INTERVENTION]</code>, <code>[MONTANT_TTC]</code>, <code>[NOM_ENTREPRISE]</code>
            </p>

            {editingId && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
                <Input placeholder="Nom du modèle" value={editNom} onChange={e => setEditNom(e.target.value)} />
                <Input placeholder="Objet de l'email" value={editObjet} onChange={e => setEditObjet(e.target.value)} />
                <Textarea placeholder="Corps du message..." value={editCorps} onChange={e => setEditCorps(e.target.value)} className="min-h-[100px]" />
                <div className="flex gap-2">
                  <Button onClick={saveTemplate} className="bg-emerald-600 hover:bg-emerald-700" size="sm">Enregistrer</Button>
                  <Button onClick={() => setEditingId(null)} variant="outline" size="sm">Annuler</Button>
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : templates.length === 0 && !editingId ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun modèle créé</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.nom}</p>
                      <p className="text-xs text-muted-foreground truncate">Objet : {t.objet}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.corps.slice(0, 80)}...</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="smtp">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Serveur mail sortant (SMTP)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Ces paramètres permettent l'envoi des bons d'intervention et devis par email. Cliquez sur « Sauvegarder les paramètres » puis testez la connexion.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Serveur SMTP</label>
                <Input
                  value={config.smtp.host}
                  onChange={(e) => updateSmtp({ host: e.target.value })}
                  placeholder="ex : ssl0.ovh.net ou smtp.ionos.fr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Port</label>
                <Input
                  value={config.smtp.port}
                  onChange={(e) => updateSmtp({ port: e.target.value })}
                  placeholder="587 (STARTTLS) ou 465 (SSL)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Identifiant (email de connexion)</label>
                <Input
                  value={config.smtp.user}
                  onChange={(e) => updateSmtp({ user: e.target.value })}
                  placeholder="contact@electriciendugenevois.fr"
                  type="email"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Mot de passe</label>
                <Input
                  value={config.smtp.pass}
                  onChange={(e) => updateSmtp({ pass: e.target.value })}
                  type="password"
                  placeholder="••••••••••••••"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Expéditeur affiché (optionnel)</label>
                <Input
                  value={config.smtp.from}
                  onChange={(e) => updateSmtp({ from: e.target.value })}
                  placeholder='Électricien du Genevois <contact@electriciendugenevois.fr>'
                />
                <p className="text-xs text-muted-foreground">Si vide, l'identifiant SMTP sera utilisé comme expéditeur.</p>
              </div>
            </div>
            <Button onClick={handleTestSmtp} disabled={testingSmtp} className="gap-2 h-12 px-6 text-base">
              {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Sauvegarder et tester l'envoi
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="dolibarr">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Connexion Dolibarr</h2>
              <div className="flex items-center gap-2">
                {config.dolibarr.connected ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Connecté</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><XCircle className="h-4 w-4" /> Non connecté</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Les credentials sont sauvegardés dans la base de données. Cliquez sur « Sauvegarder les paramètres » pour les persister.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">URL API</label>
                <Input value={config.dolibarr.apiUrl} onChange={(e) => updateDolibarr({ apiUrl: e.target.value })} placeholder="https://votre-instance.fr/api/index.php" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Clé API (DOLAPIKEY)</label>
                <Input value={config.dolibarr.apiKey} onChange={(e) => updateDolibarr({ apiKey: e.target.value })} type="password" placeholder="••••••••••••••" />
              </div>
            </div>
            <Button onClick={handleTestConnection} disabled={testing} className="gap-2 h-12 px-6 text-base">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Tester la connexion
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="utilisateurs">
          <Utilisateurs />
        </TabsContent>

        <TabsContent value="preferences">
          <Preferences />
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="bg-card rounded-lg border border-destructive/50 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Zone dangereuse — Tests</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Outils destinés uniquement à la phase de test. Les actions ci-dessous sont <strong>irréversibles</strong> et impactent directement Dolibarr.
            </p>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Supprimer tous les devis et factures</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Repasse chaque document validé en brouillon puis le supprime de Dolibarr. Vide aussi les tables de relances. Les paiements enregistrés bloqueront la suppression de leur facture.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={purging} className="gap-2">
                    {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Tout supprimer (devis + factures)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression totale ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va supprimer <strong>tous les devis et toutes les factures</strong> de Dolibarr, ainsi que leurs relances associées. Les factures avec paiements enregistrés seront ignorées.
                      <br /><br />
                      Cette action est <strong>irréversible</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handlePurgeAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
