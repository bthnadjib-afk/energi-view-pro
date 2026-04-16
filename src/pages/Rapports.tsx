import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchStatsCA, fetchFactures, fetchDevis, fetchInterventions, fetchClients,
} from '@/services/dolibarr';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, FileText, ClipboardList, Wrench, Users, Euro, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const YEARS = [2026, 2025, 2024, 2023];

export default function Rapports() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: statsCA = [], isLoading: loadingCA } = useQuery({
    queryKey: ['stats-ca', year],
    queryFn: () => fetchStatsCA(year),
  });

  const { data: factures = [] } = useQuery({ queryKey: ['factures'], queryFn: fetchFactures });
  const { data: devis = [] } = useQuery({ queryKey: ['devis'], queryFn: fetchDevis });
  const { data: interventions = [] } = useQuery({ queryKey: ['interventions'], queryFn: fetchInterventions });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });

  const totalCA = statsCA.reduce((s, m) => s + m.ca_ht, 0);
  const totalFactures = factures.length;
  const facturesPayees = factures.filter(f => f.paye).length;
  const montantImpaye = factures.filter(f => !f.paye && f.fk_statut >= 1).reduce((s, f) => s + f.resteAPayer, 0);
  const devisSignes = devis.filter(d => d.fk_statut === 2).length;
  const tauxConversion = devis.length > 0 ? Math.round((devisSignes / devis.length) * 100) : 0;

  // Top clients par CA
  const caParClient: Record<string, number> = {};
  factures.filter(f => f.paye).forEach(f => {
    if (f.client) caParClient[f.client] = (caParClient[f.client] || 0) + f.montantHT;
  });
  const topClients = Object.entries(caParClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, ca]) => ({ nom, ca }));

  const kpis = [
    { label: 'CA HT (année)', value: `${totalCA.toFixed(0)} €`, icon: Euro, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Factures', value: `${facturesPayees}/${totalFactures} payées`, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Impayés', value: `${montantImpaye.toFixed(0)} €`, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Taux conversion devis', value: `${tauxConversion}%`, icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Interventions', value: String(interventions.length), icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Clients', value: String(clients.length), icon: Users, color: 'text-teal-600', bg: 'bg-teal-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapports & Statistiques</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de l'activité</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', k.bg)}>
                <k.icon className={cn('h-5 w-5', k.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphique CA mensuel */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="font-semibold mb-4">Chiffre d'affaires mensuel HT — {year}</h2>
        {loadingCA ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statsCA} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v.toLocaleString('fr')} €`} width={80} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString('fr', { minimumFractionDigits: 2 })} €`, 'CA HT']} />
              <Bar dataKey="ca_ht" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Évolution nombre de factures */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-4">Nombre de factures / mois</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={statsCA}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="nb_factures" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Factures" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top clients */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-4">Top 5 clients (CA HT)</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topClients.map((c, i) => {
                const pct = topClients[0].ca > 0 ? (c.ca / topClients[0].ca) * 100 : 0;
                return (
                  <div key={c.nom} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">{i + 1}. {c.nom}</span>
                      <span className="text-muted-foreground">{c.ca.toFixed(0)} €</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Répartition par statut */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Devis brouillon', count: devis.filter(d => d.fk_statut === 0).length, color: 'bg-gray-100 text-gray-700' },
          { label: 'Devis validés', count: devis.filter(d => d.fk_statut === 1).length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Devis signés', count: devis.filter(d => d.fk_statut === 2).length, color: 'bg-green-100 text-green-700' },
          { label: 'Devis refusés', count: devis.filter(d => d.fk_statut === 3).length, color: 'bg-red-100 text-red-700' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <span className={cn('inline-block text-2xl font-bold px-3 py-1 rounded-lg', s.color)}>{s.count}</span>
            <p className="text-xs text-muted-foreground mt-2">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
