import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RotateCcw, Bug, Type, Maximize2, Layout } from 'lucide-react';
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
  unit: 'pt' | 'mm' | 'px';
  default: number;
}

// ─── Tailles de texte (pt) ─────────────────────────────────────────────
const TEXT_FIELDS: Field[] = [
  { key: 'tailleEntreprise',     label: 'En-tête Entreprise (Nom)',      hint: 'Nom de votre société dans le header',       min: 6,  max: 20, step: 0.5, unit: 'pt', default: 11 },
  { key: 'tailleCoordonnees',    label: 'Coordonnées (Adresse / Tel)',   hint: 'Adresse, téléphone, email — entreprise & client', min: 5, max: 14, step: 0.5, unit: 'pt', default: 9 },
  { key: 'tailleRubanLabel',     label: 'Libellés des rubans',           hint: 'Date, Référence, Échéance… (petit texte gris)', min: 4, max: 12, step: 0.5, unit: 'pt', default: 6.5 },
  { key: 'tailleRubanValeur',    label: 'Valeurs des rubans',            hint: 'Texte en gras dans le bandeau noir',         min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTableauHeader',  label: 'En-têtes du tableau',           hint: 'Description, Qté, P.U., Montant…',           min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTableauLignes',  label: 'Lignes du tableau (Articles)',  hint: 'Toutes les lignes : fournitures + main d\'œuvre', min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'tailleTotaux',         label: 'Totaux (HT / TVA)',             hint: 'Lignes des sous-totaux',                     min: 5, max: 14, step: 0.5, unit: 'pt', default: 9.5 },
  { key: 'tailleTotalTTC',       label: 'Total TTC (mise en avant)',     hint: 'Le grand montant final',                     min: 7, max: 18, step: 0.5, unit: 'pt', default: 11 },
  { key: 'tailleEncartTexte',    label: 'Texte des encarts',             hint: 'Récapitulatif + Bon pour accord',            min: 5, max: 14, step: 0.5, unit: 'pt', default: 8.5 },
  { key: 'taillePaiement',       label: 'Moyens de paiement (RIB)',      hint: 'IBAN / BIC en bas de page',                  min: 5, max: 14, step: 0.5, unit: 'pt', default: 9 },
  { key: 'taillePiedDePage',     label: 'Pied de page (mentions)',       hint: 'Assurance, mentions légales',                min: 5, max: 12, step: 0.5, unit: 'pt', default: 8 },
];

// ─── Dimensions logo & encarts (mm) ────────────────────────────────────
const SIZE_FIELDS: Field[] = [
  { key: 'logoHauteur',           label: 'Hauteur du logo',              hint: 'Hauteur max du logo dans le header',         min: 8,  max: 35, step: 0.5, unit: 'mm', default: 13 },
  { key: 'logoLargeurMax',        label: 'Largeur max du logo',          hint: 'Limite la largeur si le logo est très large', min: 20, max: 90, step: 1,   unit: 'mm', default: 48 },
  { key: 'largeurEncartTotaux',   label: 'Largeur encart Récapitulatif', hint: 'Bloc des totaux HT/TVA/TTC en bas',          min: 50, max: 120, step: 1,  unit: 'mm', default: 80 },
  { key: 'largeurEncartBonAccord', label: 'Largeur encart Bon pour accord', hint: 'Bloc de signature client',                min: 50, max: 120, step: 1,  unit: 'mm', default: 80 },
];

export default function TemplateSizesPanel({ template, updateTemplate }: Props) {
  const resetAll = () => {
    const reset: Partial<Tpl> = {
      captureWidth: 794,
      entrepriseEnFaceClient: true,
      rubanCompact: true,
    };
    [...TEXT_FIELDS, ...SIZE_FIELDS].forEach((f) => { (reset as any)[f.key] = f.default; });
    updateTemplate(reset);
  };

  const renderField = (f: Field) => {
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
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Réglages en temps réel — visibles dans l'aperçu à droite.
        </p>
        <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" /> Réinitialiser
        </Button>
      </div>

      {/* ─── Layout : toggles entreprise/client + ruban compact ──────── */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center gap-2 text-foreground">
          <Layout className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Disposition</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium">Entreprise en face du client</Label>
            <p className="text-[10px] text-muted-foreground">Place les coordonnées entreprise et client côte-à-côte</p>
          </div>
          <Switch
            checked={template.entrepriseEnFaceClient !== false}
            onCheckedChange={(v) => updateTemplate({ entrepriseEnFaceClient: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium">Ruban compact (1 ligne)</Label>
            <p className="text-[10px] text-muted-foreground">Référence + Date + Échéance sur la même ligne</p>
          </div>
          <Switch
            checked={template.rubanCompact !== false}
            onCheckedChange={(v) => updateTemplate({ rubanCompact: v })}
          />
        </div>
      </div>

      {/* ─── Tailles de texte ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-foreground">
          <Type className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Tailles de texte (pt)</span>
        </div>
        <div className="space-y-4">
          {TEXT_FIELDS.map(renderField)}
        </div>
      </div>

      {/* ─── Dimensions (mm) ──────────────────────────────────────────── */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2 text-foreground">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Dimensions (mm)</span>
        </div>
        <div className="space-y-4">
          {SIZE_FIELDS.map(renderField)}
        </div>
      </div>

      {/* ─── Zone DEBUG ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 mt-6">
        <div className="flex items-center gap-2 text-foreground">
          <Bug className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Résolution de capture PDF</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Largeur du layout HTML (px). La capture est faite à <strong>3.125× (300 DPI)</strong>.
          794 px → canvas 2481 px → <strong>300 DPI</strong> dans le PDF final.
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Largeur de capture</Label>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {template.captureWidth ?? 794}px — {Math.round((template.captureWidth ?? 794) * 3.125 / (210 / 25.4))} DPI
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
