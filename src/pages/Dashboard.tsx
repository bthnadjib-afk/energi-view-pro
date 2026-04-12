import { useState, useMemo } from 'react';
import { Euro, FileText, ClipboardList, TrendingUp, Users, AlertTriangle, Clock, Receipt, Wallet, CalendarDays } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { UrgencyWidget } from '@/components/UrgencyWidget';
import { useFactures, useDevis, useInterventions } from '@/hooks/useDolibarr';
import { formatDateFR } from '@/services/dolibarr';

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

  const totalCA = filteredFactures.reduce((s, f) => s + f.montantHT, 0);
  const devisValides = devis.filter(d => d.fk_statut === 1).length;
  const interventionsActives = interventions.filter(i => i.fk_statut === 1 || i.fk_statut === 2).length;
  const devisSignes = devis.filter(d => d.fk_statut === 2).length;
  const tauxConversion = devis.length > 0 ? Math.round((devisSignes / devis.length) * 100) : 0;

  const today = now.toISOString().slice(0, 10);
  const todayInterventions = interventions.filter(i => i.date === today);

  const techNames = useMemo(() => {
    const names = new Set<string>();
    todayInterventions.forEach(i => { if (i.technicien) names.add(i.technicien); });
    return Array.from(names);
  }, [todayInterventions]);

  const byTechnician = techNames.map(t => ({
    name: t,
    interventions: todayInterventions.filter(i => i.technicien === t),
  }));

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const devisRelances = devis.filter(d => d.fk_statut === 1 && new Date(d.date) <= sevenDaysAgo);
  const facturesImpayees = factures.filter(f => f.fk_statut >= 1 && !f.paye);
  const interventionsAValider = interventions.filter(i => i.fk_statut === 0);

  const totalImpaye = facturesImpayees.reduce((s, f) => s + f.montantHT, 0);
  const interventionsTerminees = interventions.filter(i => i.fk_statut === 3);
  const aFacturer = interventionsTerminees.length;

  const hasPriorities = devisRelances.length > 0 || facturesImpayees.length > 0 || interventionsAValider.length > 0;

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
        <StatCard title="Chiffre d'Affaires HT" value={`${totalCA.toLocaleString('fr-FR')} €`} subtitle={`${filteredFactures.length} factures`} icon={Euro} />
        <StatCard title="Devis validés" value={String(devisValides)} subtitle={`${devis.length} devis total`} icon={ClipboardList} />
        <StatCard title="Interventions actives" value={String(interventionsActives)} subtitle={`${interventions.length} total`} icon={FileText} />
        <StatCard title="Taux conversion" value={`${tauxConversion}%`} subtitle="Devis → Factures" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" /> CASH
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-red-50 border border-red-200">
              <div>
                <p className="text-sm font-medium text-foreground">Impayés</p>
                <p className="text-xs text-muted-foreground">{facturesImpayees.length} facture(s)</p>
              </div>
              <p className="text-xl font-bold text-red-600">{totalImpaye.toLocaleString('fr-FR')} €</p>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div>
                <p className="text-sm font-medium text-foreground">À facturer</p>
                <p className="text-xs text-muted-foreground">{aFacturer} intervention(s) terminée(s)</p>
              </div>
              <Receipt className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> AGENDA — Aujourd'hui
          </h2>
          {todayInterventions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune intervention aujourd'hui</p>
          ) : (
            <div className="space-y-2">
              {todayInterventions.map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs">
                  <div className="flex items-center gap-2 truncate mr-2">
                    <span className="font-mono text-muted-foreground">{i.heureDebut}–{i.heureFin}</span>
                    <span className="text-foreground truncate">{i.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{i.technicien || '—'}</span>
                    <StatusBadge statut={i.statut} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasPriorities && (
        <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> À faire en priorité
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {devisRelances.length > 0 && (
              <div className="rounded-lg p-4 border border-border border-l-4 border-l-blue-500">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" /> Relances devis ({devisRelances.length})
                </h3>
                <div className="space-y-2">
                  {devisRelances.slice(0, 5).map(d => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{d.ref} — {d.client}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{d.montantHT.toLocaleString('fr-FR')} € HT</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {facturesImpayees.length > 0 && (
              <div className="rounded-lg p-4 border border-border border-l-4 border-l-red-500">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-red-500" /> Factures impayées ({facturesImpayees.length})
                </h3>
                <div className="space-y-2">
                  {facturesImpayees.slice(0, 5).map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{f.ref} — {f.client}</span>
                      <StatusBadge statut={f.statut} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {interventionsAValider.length > 0 && (
              <div className="rounded-lg p-4 border border-border border-l-4 border-l-amber-500">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" /> Interventions brouillon ({interventionsAValider.length})
                </h3>
                <div className="space-y-2">
                  {interventionsAValider.slice(0, 5).map(i => (
                    <div key={i.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{i.ref} — {i.description}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{formatDateFR(i.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <UrgencyWidget interventions={interventions} />

      {byTechnician.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Aujourd'hui — par technicien
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {byTechnician.map(({ name, interventions: ints }) => (
              <div key={name} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">{name}</h3>
                <div className="space-y-2">
                  {ints.map(i => (
                    <div key={i.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className="text-muted-foreground">{i.heureDebut}–{i.heureFin}</span>
                        <span className="text-foreground truncate">{i.description}</span>
                      </div>
                      <StatusBadge statut={i.statut} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Interventions récentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Réf.</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Technicien</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {[...interventions]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((inter) => (
                <tr key={inter.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{inter.ref}</td>
                  <td className="py-3 px-2 text-foreground">{inter.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{inter.technicien || '—'}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{formatDateFR(inter.date)}</td>
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
