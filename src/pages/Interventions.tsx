import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useInterventions } from '@/hooks/useDolibarr';
import { techniciens, statutsIntervention } from '@/services/dolibarr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Interventions() {
  const { data: interventions = [] } = useInterventions();
  const [techFilter, setTechFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');

  const filtered = interventions.filter((i) => {
    if (techFilter !== 'all' && i.technicien !== techFilter) return false;
    if (statutFilter !== 'all' && i.statut !== statutFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Interventions</h1>
        <p className="text-muted-foreground text-sm">Planning et suivi des interventions terrain</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-full sm:w-[220px] glass border-border/50">
            <SelectValue placeholder="Technicien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {techniciens.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-[200px] glass border-border/50">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statutsIntervention.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
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
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Description</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucune intervention trouvée</td></tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-2 font-mono text-xs text-foreground">{i.ref}</td>
                    <td className="py-3 px-2 text-foreground">{i.client}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{i.technicien}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden md:table-cell text-xs">{i.description}</td>
                    <td className="py-3 px-2 text-muted-foreground">{new Date(i.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-2"><StatusBadge statut={i.statut} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
