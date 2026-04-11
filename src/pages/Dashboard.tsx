import { Euro, FileText, ClipboardList, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures, useDevis, useInterventions } from '@/hooks/useDolibarr';

export default function Dashboard() {
  const { data: factures = [] } = useFactures();
  const { data: devis = [] } = useDevis();
  const { data: interventions = [] } = useInterventions();

  const totalCA = factures.reduce((s, f) => s + f.montantTTC, 0);
  const devisEnAttente = devis.filter(d => d.statut === 'en attente').length;
  const interventionsPlanifiees = interventions.filter(i => i.statut === 'planifié' || i.statut === 'en cours').length;
  const devisAcceptes = devis.filter(d => d.statut === 'accepté').length;
  const tauxConversion = devis.length > 0 ? Math.round((devisAcceptes / devis.length) * 100) : 0;

  const recentInterventions = [...interventions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d'Affaires"
          value={`${totalCA.toLocaleString('fr-FR')} €`}
          subtitle={`${factures.length} factures`}
          icon={Euro}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Devis en attente"
          value={String(devisEnAttente)}
          subtitle={`${devis.length} devis total`}
          icon={ClipboardList}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <StatCard
          title="Interventions actives"
          value={String(interventionsPlanifiees)}
          subtitle={`${interventions.length} total`}
          icon={FileText}
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
        />
        <StatCard
          title="Taux conversion"
          value={`${tauxConversion}%`}
          subtitle="Devis → Factures"
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
        />
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">Interventions récentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Technicien</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentInterventions.map((inter) => (
                <tr key={inter.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{inter.ref}</td>
                  <td className="py-3 px-2 text-foreground">{inter.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{inter.technicien}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{new Date(inter.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-2"><StatusBadge statut={inter.statut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
