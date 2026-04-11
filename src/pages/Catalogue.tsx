import { useProduits } from '@/hooks/useDolibarr';
import { Package, Wrench } from 'lucide-react';

export default function Catalogue() {
  const { data: produits = [] } = useProduits();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catalogue</h1>
        <p className="text-muted-foreground text-sm">Produits & services — endpoint /products</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produits.map((p) => (
          <div key={p.id} className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform group relative overflow-hidden">
            <div className={`absolute inset-0 opacity-5 ${p.type === 'service' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-green-600'}`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.type === 'service' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-green-600'}`}>
                  {p.type === 'service' ? <Wrench className="h-4 w-4 text-foreground" /> : <Package className="h-4 w-4 text-foreground" />}
                </div>
                <span className="text-xs font-mono text-muted-foreground">{p.ref}</span>
              </div>

              <h3 className="font-semibold text-foreground mb-1">{p.label}</h3>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.description}</p>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">{p.prixHT.toLocaleString('fr-FR')} €</p>
                  <p className="text-xs text-muted-foreground">HT</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-accent/30 px-2 py-0.5 text-xs text-muted-foreground">
                    TVA {p.tauxTVA}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{p.categorie}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
