import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, FileText, ClipboardList, Wrench, AlertTriangle,
  FileDown, MapPin, Phone, AtSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { useClients, useDevis, useFactures, useInterventions } from '@/hooks/useDolibarr';
import { useDevisRelances, getDevisRelanceStatus } from '@/hooks/useDevisRelances';
import { useFactureRelances, getRelanceStatus } from '@/hooks/useFactureRelances';
import { formatDateFR } from '@/services/dolibarr';
import { openDevisPdf } from '@/services/devisPdf';
import { openFacturePdf } from '@/services/facturePdf';
import { supabase } from '@/integrations/supabase/client';
import { useConfig } from '@/hooks/useConfig';
import { cn } from '@/lib/utils';

interface EmailRecord {
  id: string;
  document_ref: string | null;
  destinataire: string;
  objet: string;
  message: string;
  created_at: string;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();
  const { data: clients = [] } = useClients();
  const { data: allDevis = [] } = useDevis();
  const { data: allFactures = [] } = useFactures();
  const { data: allInterventions = [] } = useInterventions();
  const { data: devisRelances = [] } = useDevisRelances();
  const { data: factureRelances = [] } = useFactureRelances();

  const client = useMemo(() => clients.find(c => c.id === id), [clients, id]);

  const devis = useMemo(() => allDevis.filter(d => d.socid === id), [allDevis, id]);
  const factures = useMemo(() => allFactures.filter(f => f.socid === id), [allFactures, id]);
  const interventions = useMemo(() => allInterventions.filter(i => i.socid === id), [allInterventions, id]);

  // Emails envoyés à ce client
  const { data: emails = [] } = useQuery({
    queryKey: ['client_emails', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq('client_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EmailRecord[];
    },
  });

  // Maps relances
  const devisRelanceById = useMemo(() => {
    const m = new Map<string, typeof devisRelances[0]>();
    devisRelances.forEach(r => m.set(r.devis_id, r));
    return m;
  }, [devisRelances]);
  const factureRelanceById = useMemo(() => {
    const m = new Map<string, typeof factureRelances[0]>();
    factureRelances.forEach(r => m.set(r.facture_id, r));
    return m;
  }, [factureRelances]);

  // Relances actives
  const devisARelancer = useMemo(() => {
    return devis
      .filter(d => d.fk_statut === 1)
      .map(d => ({ devis: d, status: getDevisRelanceStatus(devisRelanceById.get(d.id), d.fk_statut, d.dateValidation) }))
      .filter(({ status }) => status.variant === 'a_relancer' || status.variant === 'expire');
  }, [devis, devisRelanceById]);

  const facturesARelancer = useMemo(() => {
    return factures
      .filter(f => f.fk_statut >= 1 && !f.paye)
      .map(f => ({ facture: f, status: getRelanceStatus(factureRelanceById.get(f.id), f.paye, f.dateValidation) }))
      .filter(({ status }) => status.variant !== 'none');
  }, [factures, factureRelanceById]);

  // Stats
  const totalCAClient = factures.reduce((s, f) => s + f.montantHT, 0);
  const totalImpaye = factures.filter(f => !f.paye).reduce((s, f) => s + f.resteAPayer, 0);

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour aux clients
        </Button>
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">Client introuvable</p>
        </div>
      </div>
    );
  }

  const relanceColor = (variant: string) => {
    if (variant === 'mise_en_demeure' || variant === 'expire') return 'text-red-600';
    if (variant === 'relance_1' || variant === 'a_relancer') return 'text-orange-600';
    return 'text-blue-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => navigate('/clients')} className="gap-2 mb-3">
          <ArrowLeft className="h-4 w-4" /> Retour aux clients
        </Button>
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">{client.nom}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {client.adresse && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.adresse}, {client.codePostal} {client.ville}</span>
                )}
                {client.telephone && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.telephone}</span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1"><AtSign className="h-3.5 w-3.5" />{client.email}</span>
                )}
              </div>
              {(client.typeLogement || client.etage || client.codePorte) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  {client.typeLogement && (
                    <span className="capitalize">🏠 {client.typeLogement}</span>
                  )}
                  {client.etage && (
                    <span>Étage : <span className="text-foreground font-medium">{client.etage}</span></span>
                  )}
                  {client.codePorte && (
                    <span>Code porte : <span className="text-foreground font-medium font-mono">{client.codePorte}</span></span>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center px-3">
                <div className="text-xs text-muted-foreground">CA HT</div>
                <div className="text-lg font-semibold text-foreground">{totalCAClient.toLocaleString('fr-FR')} €</div>
              </div>
              <div className="text-center px-3">
                <div className="text-xs text-muted-foreground">Impayé</div>
                <div className={cn('text-lg font-semibold', totalImpaye > 0 ? 'text-red-600' : 'text-foreground')}>{totalImpaye.toLocaleString('fr-FR')} €</div>
              </div>
              <div className="text-center px-3">
                <div className="text-xs text-muted-foreground">Documents</div>
                <div className="text-lg font-semibold text-foreground">{devis.length + factures.length + interventions.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="devis" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="devis" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Devis ({devis.length})
          </TabsTrigger>
          <TabsTrigger value="factures" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Factures ({factures.length})
          </TabsTrigger>
          <TabsTrigger value="interventions" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Interventions ({interventions.length})
          </TabsTrigger>
          <TabsTrigger value="relances" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Relances ({devisARelancer.length + facturesARelancer.length})
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Emails ({emails.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> Documents
          </TabsTrigger>
        </TabsList>

        {/* DEVIS */}
        <TabsContent value="devis">
          <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
            {devis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun devis pour ce client</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Montant HT</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {devis.map(d => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs text-foreground">{d.ref}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDateFR(d.date)}</td>
                      <td className="py-3 px-2 text-foreground">{d.montantHT.toLocaleString('fr-FR')} €</td>
                      <td className="py-3 px-2"><StatusBadge statut={d.statut as any} /></td>
                      <td className="py-3 px-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDevisPdf({ devis: d, client, entreprise: config.entreprise })}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* FACTURES */}
        <TabsContent value="factures">
          <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
            {factures.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune facture pour ce client</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Total TTC</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Reste à payer</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.map(f => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs text-foreground">{f.ref}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDateFR(f.date)}</td>
                      <td className="py-3 px-2 text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                      <td className={cn('py-3 px-2', f.resteAPayer > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                        {f.resteAPayer.toLocaleString('fr-FR')} €
                      </td>
                      <td className="py-3 px-2"><StatusBadge statut={f.statut as any} /></td>
                      <td className="py-3 px-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openFacturePdf({ facture: f, client, entreprise: config.entreprise })}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* INTERVENTIONS */}
        <TabsContent value="interventions">
          <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
            {interventions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune intervention pour ce client</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Technicien</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Description</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {interventions.map(i => (
                    <tr
                      key={i.id}
                      onClick={() => navigate('/interventions')}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-2 font-mono text-xs text-foreground">{i.ref}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDateFR(i.date)}</td>
                      <td className="py-3 px-2 text-muted-foreground">{i.technicien || '—'}</td>
                      <td className="py-3 px-2 text-foreground truncate max-w-md">{i.description}</td>
                      <td className="py-3 px-2"><StatusBadge statut={i.statut as any} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* RELANCES */}
        <TabsContent value="relances">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border border-border border-l-4 border-l-orange-500 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-500" />
                Devis à relancer ({devisARelancer.length})
              </h3>
              {devisARelancer.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Aucun devis à relancer</p>
              ) : (
                <div className="space-y-2">
                  {devisARelancer.map(({ devis: d, status }) => (
                    <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                      <span className="font-mono text-foreground">{d.ref}</span>
                      <span className="text-muted-foreground">{formatDateFR(d.date)}</span>
                      <span className={cn('font-medium', relanceColor(status.variant))}>{status.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card rounded-lg border border-border border-l-4 border-l-red-500 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" />
                Factures impayées ({facturesARelancer.length})
              </h3>
              {facturesARelancer.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Aucune facture à relancer</p>
              ) : (
                <div className="space-y-2">
                  {facturesARelancer.map(({ facture: f, status }) => (
                    <div key={f.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                      <span className="font-mono text-foreground">{f.ref}</span>
                      <span className="text-foreground">{f.resteAPayer.toLocaleString('fr-FR')} €</span>
                      <span className={cn('font-medium', relanceColor(status.variant))}>{status.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* EMAILS */}
        <TabsContent value="emails">
          <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun email envoyé à ce client</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Document</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Objet</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Destinataire</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map(e => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 text-muted-foreground text-xs">{formatDateFR(e.created_at)}</td>
                      <td className="py-3 px-2 font-mono text-xs text-foreground">{e.document_ref || '—'}</td>
                      <td className="py-3 px-2 text-foreground">{e.objet}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{e.destinataire}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* DOCUMENTS — liste regroupée de tous les PDFs */}
        <TabsContent value="documents">
          <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Devis PDFs */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" /> Devis
                </h3>
                {devis.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun</p>
                ) : (
                  <div className="space-y-1">
                    {devis.map(d => (
                      <button
                        key={d.id}
                        onClick={() => openDevisPdf({ devis: d, client, entreprise: config.entreprise })}
                        className="w-full flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-mono text-foreground truncate">{d.ref}</span>
                        <FileDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Factures PDFs */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" /> Factures
                </h3>
                {factures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune</p>
                ) : (
                  <div className="space-y-1">
                    {factures.map(f => (
                      <button
                        key={f.id}
                        onClick={() => openFacturePdf({ facture: f, client, entreprise: config.entreprise })}
                        className="w-full flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-mono text-foreground truncate">{f.ref}</span>
                        <FileDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Interventions PDFs */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-emerald-500" /> Interventions
                </h3>
                {interventions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune</p>
                ) : (
                  <div className="space-y-1">
                    {interventions.map(i => (
                      <button
                        key={i.id}
                        onClick={() => navigate('/interventions')}
                        className="w-full flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="font-mono text-foreground truncate">{i.ref}</span>
                        <span className="text-muted-foreground text-[10px] shrink-0 ml-2">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
