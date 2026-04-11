import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { useDevis } from '@/hooks/useDolibarr';
import { getAcompteBadge, type Devis as DevisType } from '@/services/dolibarr';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

function AcompteBadge({ montantTTC }: { montantTTC: number }) {
  const { label, variant } = getAcompteBadge(montantTTC);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      variant === 'green'
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    )}>
      {label}
    </span>
  );
}

function DevisDetail({ devis }: { devis: DevisType }) {
  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-accent/20 p-4 mx-2 mb-2 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground mb-2">Détail des lignes</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-1 text-muted-foreground">Désignation</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Qté</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Prix Unit.</th>
                <th className="text-right py-2 px-1 text-muted-foreground">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {devis.lignes.map((l, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td className="py-2 px-1 text-foreground">{l.designation}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.quantite}</td>
                  <td className="py-2 px-1 text-right text-muted-foreground">{l.prixUnitaire.toLocaleString('fr-FR')} €</td>
                  <td className="py-2 px-1 text-right font-medium text-foreground">{l.totalHT.toLocaleString('fr-FR')} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function Devis() {
  const { data: devis = [] } = useDevis();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Devis</h1>
        <p className="text-muted-foreground text-sm">Propositions commerciales et règle d'acompte</p>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium w-8"></th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Référence</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Montant TTC</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Statut</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Acompte</th>
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <>
                  <tr
                    key={d.id}
                    className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  >
                    <td className="py-3 px-2">
                      {expandedId === d.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 px-2 font-mono text-xs text-foreground">{d.ref}</td>
                    <td className="py-3 px-2 text-foreground">{d.client}</td>
                    <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell">{new Date(d.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">{d.montantTTC.toLocaleString('fr-FR')} €</td>
                    <td className="py-3 px-2 hidden md:table-cell"><StatusBadge statut={d.statut} /></td>
                    <td className="py-3 px-2"><AcompteBadge montantTTC={d.montantTTC} /></td>
                  </tr>
                  {expandedId === d.id && <DevisDetail key={`detail-${d.id}`} devis={d} />}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
