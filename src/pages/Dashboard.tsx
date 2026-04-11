import { useState } from 'react';
import { Euro, FileText, ClipboardList, TrendingUp, Users } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { UrgencyWidget } from '@/components/UrgencyWidget';
import { useFactures, useDevis, useInterventions } from '@/hooks/useDolibarr';
import { techniciens } from '@/services/dolibarr';

export default function Dashboard() {
  const { data: factures = [] } = useFactures();
  const { data: devis = [] } = useDevis();
  const { data: interventions = [] } = useInterventions();
  const [period, setPeriod] = useState<Period>('annuel');

  const now = new Date();
  const filteredFactures = factures.filter((f) => {
    const d = new Date(f.date);
    if (period === 'hebdomadaire') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === 'mensuel') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear();
  });

  const totalCA = filteredFactures.reduce((s, f) => s + f.montantTTC, 0);
  const devisEnAttente = devis.filter(d => d.statut === 'en attente').length;
  const interventionsPlanifiees = interventions.filter(i => i.statut === 'planifié' || i.statut === 'en cours').length;
  const devisAcceptes = devis.filter(d => d.statut === 'accepté').length;
  const tauxConversion = devis.length > 0 ? Math.round((devisAcceptes / devis.length) * 100) : 0;

  const today = now.toISOString().slice(0, 10);
  const todayInterventions = interventions.filter(i => i.date === today);
  const byTechnician = techniciens.map(t => ({
    name: t,
    interventions: todayInterventions.filter(i => i.technicien === t),
  }));

  const recentInterventions = [...interventions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Vue d'ensemble de votre activité</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d'Affaires"
          value={`${totalCA.toLocaleString('fr-FR')} €`}
          subtitle={`${filteredFactures.length} factures`}
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

      <UrgencyWidget interventions={interventions} />

      {/* Today view */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Aujourd'hui — par technicien
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {byTechnician.map(({ name, interventions: ints }) => (
            <div key={name} className="glass rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">{name}</h3>
              {ints.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune intervention</p>
              ) : (
                <div className="space-y-2">
                  {ints.map(i => (
                    <div key={i.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{i.description}</span>
                      <StatusBadge statut={i.statut} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
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
