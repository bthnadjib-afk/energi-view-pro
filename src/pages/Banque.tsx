import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchComptesBancaires, fetchLignesBancaires, type CompteBancaire } from '@/services/dolibarr';
import { Button } from '@/components/ui/button';
import { Landmark, TrendingUp, TrendingDown, Loader2, ChevronRight } from 'lucide-react';
import { formatDateFR } from '@/services/dolibarr';
import { cn } from '@/lib/utils';

export default function Banque() {
  const { data: comptes = [], isLoading } = useQuery({ queryKey: ['comptes-bancaires'], queryFn: fetchComptesBancaires });
  const [selectedCompte, setSelectedCompte] = useState<CompteBancaire | null>(null);

  const { data: lignes = [], isLoading: loadingLignes } = useQuery({
    queryKey: ['lignes-bancaires', selectedCompte?.id],
    queryFn: () => fetchLignesBancaires(selectedCompte!.id, 100),
    enabled: !!selectedCompte,
  });

  const totalSolde = comptes.reduce((s, c) => s + c.solde, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banque & Trésorerie</h1>
        <p className="text-sm text-muted-foreground">{comptes.length} compte(s) — Solde total : <span className={cn('font-semibold', totalSolde >= 0 ? 'text-green-600' : 'text-red-600')}>{totalSolde.toFixed(2)} €</span></p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Liste des comptes */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comptes</h2>
            {comptes.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
                Aucun compte bancaire configuré dans Dolibarr
              </div>
            ) : comptes.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCompte(c)}
                className={cn(
                  'w-full text-left bg-card rounded-xl border p-4 transition-colors hover:border-primary/60',
                  selectedCompte?.id === c.id ? 'border-primary' : 'border-border'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.ref} · {c.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-bold text-sm', c.solde >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {c.solde.toFixed(2)} {c.currency}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </div>
                </div>
                {c.iban && <p className="mt-2 text-xs text-muted-foreground font-mono">{c.iban}</p>}
              </button>
            ))}
          </div>

          {/* Détail du compte sélectionné */}
          <div className="lg:col-span-8">
            {!selectedCompte ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
                Sélectionnez un compte pour voir les opérations
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedCompte.label}</h3>
                    <p className="text-xs text-muted-foreground">Dernières opérations</p>
                  </div>
                  <span className={cn('font-bold', selectedCompte.solde >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {selectedCompte.solde.toFixed(2)} {selectedCompte.currency}
                  </span>
                </div>
                {loadingLignes ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="divide-y divide-border">
                    {lignes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Aucune opération</div>
                    ) : lignes.map(l => (
                      <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', l.sens === 'C' ? 'bg-green-100' : 'bg-red-100')}>
                            {l.sens === 'C'
                              ? <TrendingUp className="h-4 w-4 text-green-600" />
                              : <TrendingDown className="h-4 w-4 text-red-600" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{l.label || '—'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateFR(l.date)}</p>
                          </div>
                        </div>
                        <span className={cn('font-semibold text-sm', l.sens === 'C' ? 'text-green-600' : 'text-red-600')}>
                          {l.sens === 'C' ? '+' : '-'}{l.montant.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
