import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Euro, FileText, ClipboardList, TrendingUp, Users, AlertTriangle,
  Receipt, CalendarDays, Wrench, ChevronRight,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { PeriodSelector, type Period } from '@/components/PeriodSelector';
import { UrgencyWidget } from '@/components/UrgencyWidget';
import { useFactures, useDevis, useInterventions } from '@/hooks/useDolibarr';
import { useFactureRelances, getRelanceStatus } from '@/hooks/useFactureRelances';
import { useDevisRelances, getDevisRelanceStatus } from '@/hooks/useDevisRelances';
import { formatDateFR } from '@/services/dolibarr';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: factures = [] } = useFactures();
  const { data: devis = [] } = useDevis();
  const { data: interventions = [] } = useInterventions();
  const { data: factureRelances = [] } = useFactureRelances();
  const { data: devisRelancesData = [] } = useDevisRelances();
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

  // === PRIORITIES ===

  // 1) Factures impayées avec relances (envoyées/relancées/mise en demeure)
  const factureRelanceById = useMemo(() => {
    const m = new Map<string, typeof factureRelances[0]>();
    factureRelances.forEach(r => m.set(r.facture_id, r));
    return m;
  }, [factureRelances]);
  const facturesARelancer = useMemo(() => {
    return factures
      .filter(f => f.fk_statut >= 1 && !f.paye)
      .map(f => ({
        facture: f,
        status: getRelanceStatus(factureRelanceById.get(f.id), f.paye, f.dateValidation),
      }))
      .filter(({ status }) => status.variant !== 'none');
  }, [factures, factureRelanceById]);

  // 2) Devis signés sans intervention liée → à créer
  const devisSignesSansIntervention = useMemo(() => {
    return devis.filter(d => {
      if (d.fk_statut !== 2) return false; // signé
      // Pas d'intervention associée à ce client/projet récent : heuristique simple = aucune intervention récente avec ce socid
      const linked = interventions.some(i => i.socid === d.socid && new Date(i.date) >= new Date(d.date));
      return !linked;
    });
  }, [devis, interventions]);

  // 3) Devis à relancer (envoyés/validés depuis ≥7j sans signature)
  const devisRelanceById = useMemo(() => {
    const m = new Map<string, typeof devisRelancesData[0]>();
    devisRelancesData.forEach(r => m.set(r.devis_id, r));
    return m;
  }, [devisRelancesData]);
  const devisARelancer = useMemo(() => {
    return devis
      .filter(d => d.fk_statut === 1) // envoyé/validé, pas signé
      .map(d => ({
        devis: d,
        status: getDevisRelanceStatus(devisRelanceById.get(d.id), d.fk_statut, d.dateValidation),
      }))
      .filter(({ status }) => status.variant === 'a_relancer' || status.variant === 'expire');
  }, [devis, devisRelanceById]);

  const hasPriorities =
    facturesARelancer.length > 0 || devisSignesSansIntervention.length > 0 || devisARelancer.length > 0;

  const relanceColor = (variant: string) => {
    if (variant === 'mise_en_demeure') return 'text-red-600';
    if (variant === 'relance_1') return 'text-orange-600';
    if (variant === 'a_relancer') return 'text-orange-600';
    if (variant === 'expire') return 'text-red-600';
    return 'text-blue-600';
  };

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

      {/* AGENDA jour seul (CASH retiré) */}
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

      {hasPriorities && (
        <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> À faire en priorité
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {facturesARelancer.length > 0 && (
              <button
                onClick={() => navigate('/factures')}
                className="text-left rounded-lg p-4 border border-border border-l-4 border-l-red-500 hover:bg-muted/50 transition-colors group"
              >
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-red-500" />
                    Relances factures ({facturesARelancer.length})
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h3>
                <div className="space-y-2">
                  {facturesARelancer.slice(0, 5).map(({ facture, status }) => (
                    <div key={facture.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{facture.ref} — {facture.client}</span>
                      <span className={`whitespace-nowrap font-medium ${relanceColor(status.variant)}`}>
                        {status.label}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            )}

            {devisSignesSansIntervention.length > 0 && (
              <button
                onClick={() => navigate('/interventions')}
                className="text-left rounded-lg p-4 border border-border border-l-4 border-l-emerald-500 hover:bg-muted/50 transition-colors group"
              >
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-emerald-500" />
                    Interventions à créer ({devisSignesSansIntervention.length})
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h3>
                <div className="space-y-2">
                  {devisSignesSansIntervention.slice(0, 5).map(d => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{d.ref} — {d.client}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {d.montantHT.toLocaleString('fr-FR')} € HT
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            )}

            {devisARelancer.length > 0 && (
              <button
                onClick={() => navigate('/devis')}
                className="text-left rounded-lg p-4 border border-border border-l-4 border-l-orange-500 hover:bg-muted/50 transition-colors group"
              >
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-orange-500" />
                    Relances devis ({devisARelancer.length})
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h3>
                <div className="space-y-2">
                  {devisARelancer.slice(0, 5).map(({ devis: d, status }) => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{d.ref} — {d.client}</span>
                      <span className={`whitespace-nowrap font-medium ${relanceColor(status.variant)}`}>
                        {status.label}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
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
