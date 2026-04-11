import { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { testDolibarrConnection } from '@/services/dolibarr';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Settings2, Bell, Database, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Configuration() {
  const { config, saving, updateEntreprise, updateDefaults, updateNotifications, updateDolibarr, saveToSupabase } = useConfig();
  const [testing, setTesting] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
          <p className="text-muted-foreground text-sm">Paramètres de l'application</p>
        </div>
        <Button
          onClick={saveToSupabase}
          disabled={saving}
          className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder les paramètres
        </Button>
      </div>

      <Tabs defaultValue="entreprise" className="space-y-4">
        <TabsList className="glass border-border/50">
          <TabsTrigger value="entreprise" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="h-3.5 w-3.5" /> Entreprise
          </TabsTrigger>
          <TabsTrigger value="defaults" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Valeurs par défaut
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="dolibarr" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Database className="h-3.5 w-3.5" /> Dolibarr
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entreprise">
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informations entreprise</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nom de l'entreprise</label>
                <Input value={config.entreprise.nom} onChange={(e) => updateEntreprise({ nom: e.target.value })} className="glass border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">SIRET</label>
                <Input value={config.entreprise.siret} onChange={(e) => updateEntreprise({ siret: e.target.value })} className="glass border-border/50" placeholder="123 456 789 00001" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Adresse</label>
                <AddressAutocomplete
                  value={config.entreprise.adresse}
                  onSelect={(addr) => updateEntreprise({ adresse: addr.rue, codePostal: addr.codePostal, ville: addr.ville })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Téléphone</label>
                <Input value={config.entreprise.telephone} onChange={(e) => updateEntreprise({ telephone: e.target.value })} className="glass border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Email</label>
                <Input value={config.entreprise.email} onChange={(e) => updateEntreprise({ email: e.target.value })} type="email" className="glass border-border/50" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="defaults">
          <div className="glass rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Valeurs par défaut</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Taux TVA (%)</label>
                <Input type="number" value={config.defaults.tauxTVA} onChange={(e) => updateDefaults({ tauxTVA: Number(e.target.value) })} className="glass border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Délai de paiement (jours)</label>
                <Input type="number" value={config.defaults.delaiPaiement} onChange={(e) => updateDefaults({ delaiPaiement: Number(e.target.value) })} className="glass border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Durée intervention par défaut (heures)</label>
                <Input type="number" value={config.defaults.dureeIntervention} onChange={(e) => updateDefaults({ dureeIntervention: Number(e.target.value) })} className="glass border-border/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Taux horaire (€/h)</label>
                <Input type="number" value={config.defaults.tauxHoraire} onChange={(e) => updateDefaults({ tauxHoraire: Number(e.target.value) })} className="glass border-border/50" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="glass rounded-xl p-6 space-y-4">
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

        <TabsContent value="dolibarr">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Connexion Dolibarr</h2>
              <div className="flex items-center gap-2">
                {config.dolibarr.connected ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Connecté</span>
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
                <Input value={config.dolibarr.apiUrl} onChange={(e) => updateDolibarr({ apiUrl: e.target.value })} className="glass border-border/50" placeholder="https://votre-instance.fr/api/index.php" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Clé API (DOLAPIKEY)</label>
                <Input value={config.dolibarr.apiKey} onChange={(e) => updateDolibarr({ apiKey: e.target.value })} type="password" className="glass border-border/50" placeholder="••••••••••••••" />
              </div>
            </div>
            <Button onClick={handleTestConnection} disabled={testing} className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 h-12 px-6 text-base">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Tester la connexion
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
