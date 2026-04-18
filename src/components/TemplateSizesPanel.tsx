import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw, Bug } from 'lucide-react';
import type { AppConfig } from '@/hooks/useConfig';

type Tpl = AppConfig['template'];

interface Props {
  template: Tpl;
  updateTemplate: (u: Partial<Tpl>) => void;
}

interface Field {
  key: keyof Tpl;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  unit: 'pt' | 'px';
  default: number;
}

const FIELDS: Field[] = [
  { key: 'tailleEntreprise',     label: 'En-tête Entreprise (Nom)',      hint: 'Nom de votre société dans le header',       min: 6,  max: 20, step: 0.5, unit: 'pt', default: 11 },
  { key: 'tailleCoordonnees',    label: 'Coordonnées (Adresse / Tel)',   hint: 'Adresse, téléphone, email — entreprise & client', min: 5, max: 14, step: 0.5, unit: 'pt', default: 9 },
  { key: 'tailleRubanLabel',     label: 'Libellés des rubans',           hint: 'Date, Référence, Échéance… (petit texte gris)', min: 4, max: 12, step: 0.5, unit: 'pt', default: 6.5 },
  { key: 'tailleRubanValeur',    label: 'Valeurs des rubans',            hint: 'Texte en gras dans le bandeau noir',         min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTableauHeader',  label: 'En-têtes du tableau',           hint: 'Description, Qté, P.U., Montant…',           min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTableauLignes',  label: 'Lignes du tableau (Articles)',  hint: 'Toutes les lignes : fournitures + main d\'œuvre', min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTotaux',         label: 'Totaux (HT / TVA)',             hint: 'Lignes des sous-totaux',                     min: 5, max: 14, step: 0.5, unit: 'pt', default: 9.5 },
  { key: 'tailleTotalTTC',       label: 'Total TTC (mise en avant)',     hint: 'Le grand montant final',                     min: 7, max: 18, step: 0.5, unit: 'pt', default: 11 },
];

export default function TemplateSizesPanel({ template, updateTemplate }: Props) {
  const resetAll = () => {
    const reset: Partial<Tpl> = { captureWidth: 794 };
    FIELDS.forEach((f) => { (reset as any)[f.key] = f.default; });
    updateTemplate(reset);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Réglez chaque taille de texte indépendamment. Les modifications sont visibles en temps réel.
        </p>
        <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" /> Tout réinitialiser
        </Button>
      </div>

      <div className="space-y-4">
        {FIELDS.map((f) => {
          const value = (template[f.key] as number | undefined) ?? f.default;
          return (
            <div key={String(f.key)} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{f.label}</Label>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {value}{f.unit}
                </span>
              </div>
              {f.hint && <p className="text-[10px] text-muted-foreground/80 leading-tight">{f.hint}</p>}
              <Slider
                value={[value]}
                min={f.min}
                max={f.max}
                step={f.step}
                onValueChange={(v) => updateTemplate({ [f.key]: v[0] } as Partial<Tpl>)}
              />
            </div>
          );
        })}
      </div>

      {/* ─── Zone DEBUG ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 mt-6">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Bug className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Debug — Échelle de capture</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Largeur du viewport HTML utilisée pour la capture PDF. <strong>794px = A4 strict @ 96 DPI</strong> (par défaut).
          Augmentez si le PDF apparaît trop zoomé, diminuez s'il apparaît trop petit.
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Largeur de capture</Label>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {template.captureWidth ?? 794}px
          </span>
        </div>
        <Slider
          value={[template.captureWidth ?? 794]}
          min={700}
          max={1200}
          step={2}
          onValueChange={(v) => updateTemplate({ captureWidth: v[0] })}
        />
        <div className="flex gap-1.5 pt-1">
          {[750, 794, 850, 900, 1000].map((w) => (
            <Button
              key={w}
              variant="outline"
              size="sm"
              className="h-6 text-[10px] flex-1"
              onClick={() => updateTemplate({ captureWidth: w })}
            >
              {w}px
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
