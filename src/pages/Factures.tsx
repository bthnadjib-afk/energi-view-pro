import { Euro, CheckCircle, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useFactures } from '@/hooks/useDolibarr';

export default function Factures() {
  const { data: factures = [] } = useFactures();

  const totalCA = factures.reduce((s, f) => s + f.montantTTC, 0);
  const payees = factures.filter(f => f.statut === 'payée');
  const impayees = factures.filter(f => f.statut !== 'payée');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Factures</h1>
        <p className="text-muted-foreground text-sm">Gestion des factures clients</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total CA" value={`${totalCA.toLocaleString('fr-FR')} €`} icon={Euro} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
        <StatCard title="Factures payées" value={String(payees.length)} subtitle={`${payees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={CheckCircle} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
        <StatCard title="Factures impayées" value={String(impayees.length)} subtitle={`${impayees.reduce((s, f) => s + f.montantTTC, 0).toLocaleString('fr-FR')} €`} icon={AlertCircle} gradient="bg-gradient-to-br from-orange-500 to-amber-600" />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant TTC</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-2 font-mono text-xs text-foreground">{f.ref}</td>
                  <td className="py-3 px-2 text-foreground">{f.client}</td>
                  <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{new Date(f.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-2 text-right font-medium text-foreground">{f.montantTTC.toLocaleString('fr-FR')} €</td>
                  <td className="py-3 px-2"><StatusBadge statut={f.statut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
