import { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, Palette, Type, Maximize2, FileText, Image as ImageIcon, Eye, Save, RotateCcw, Trash2, Loader2, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useConfig, type AppConfig } from '@/hooks/useConfig';
import { DocumentTemplate, type DocType as SharedDocType } from '@/services/DocumentTemplate';
import { documentPdfToBlobUrl } from '@/services/htmlToPdf';

type DocType = 'facture' | 'devis' | 'intervention';

const DOC_LABELS: Record<DocType, string> = {
  facture: 'Facture',
  devis: 'Devis',
  intervention: "Bon d'intervention",
};

const SAMPLE_LIGNES = [
  { desc: 'Câble électrique 3G2,5mm² — 100m', ref: 'CAB001', qte: 2, pu: 89.50, tva: 20 },
  { desc: 'Disjoncteur différentiel 30mA 40A', ref: 'DIS40', qte: 4, pu: 45.00, tva: 20 },
  { desc: "Main d'œuvre installation tableau", ref: 'MO-INST', qte: 6, pu: 45.00, tva: 20 },
];

export default function TemplatePlayground() {
  const { config, updateTemplate, saveToSupabase, saving } = useConfig();
  const t = config.template;
  const [previewType, setPreviewType] = useState<DocType>('facture');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Calculs sample
  const totals = useMemo(() => {
    const ht = SAMPLE_LIGNES.reduce((s, l) => s + l.qte * l.pu, 0);
    const tva = SAMPLE_LIGNES.reduce((s, l) => s + (l.qte * l.pu * l.tva) / 100, 0);
    return { ht, tva, ttc: ht + tva };
  }, []);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo trop lourd (max 2 Mo)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('document-logos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('document-logos').getPublicUrl(path);
      updateTemplate({ logoUrl: pub.publicUrl });
      toast.success('Logo téléversé');
    } catch (e: any) {
      toast.error(`Erreur upload : ${e.message || e}`);
    }
    setUploading(false);
  };

  const resetTemplate = () => {
    updateTemplate({
      logoUrl: '',
      couleurPrimaire: '#1a1a1a',
      couleurAccent: '#cc0000',
      couleurTexte: '#1a1a1a',
      police: 'helvetica',
      margeHaut: 18,
      margeBas: 20,
      margeGauche: 15,
      margeDroite: 15,
      tailleTitre: 22,
      tailleTexte: 8.5,
      piedDePage: '',
      afficherRib: true,
      afficherCgv: true,
      texteCgv: '',
    });
    toast.success('Template réinitialisé aux valeurs par défaut');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* ═══ PANNEAU GAUCHE — CONFIG ═══ */}
      <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4" /> Personnalisation
            </h3>
            <Button variant="ghost" size="sm" onClick={resetTemplate} title="Réinitialiser">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Tabs defaultValue="logo" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-auto">
              <TabsTrigger value="logo" className="flex-col gap-1 py-2 text-xs"><ImageIcon className="h-3.5 w-3.5" />Logo</TabsTrigger>
              <TabsTrigger value="couleurs" className="flex-col gap-1 py-2 text-xs"><Palette className="h-3.5 w-3.5" />Couleurs</TabsTrigger>
              <TabsTrigger value="typo" className="flex-col gap-1 py-2 text-xs"><Type className="h-3.5 w-3.5" />Police</TabsTrigger>
              <TabsTrigger value="mise" className="flex-col gap-1 py-2 text-xs"><Maximize2 className="h-3.5 w-3.5" />Marges</TabsTrigger>
            </TabsList>

            {/* LOGO */}
            <TabsContent value="logo" className="space-y-4 mt-4">
              <div className="aspect-[3/1] rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground text-xs">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Logo par défaut utilisé
                  </div>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
              <div className="flex gap-2">
                <Button onClick={() => fileInput.current?.click()} disabled={uploading} size="sm" className="flex-1 gap-2">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Envoi...' : 'Téléverser un logo'}
                </Button>
                {t.logoUrl && (
                  <Button variant="outline" size="sm" onClick={() => updateTemplate({ logoUrl: '' })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG / JPG / WebP — max 2 Mo</p>
            </TabsContent>

            {/* COULEURS */}
            <TabsContent value="couleurs" className="space-y-4 mt-4">
              <ColorField label="Couleur primaire (titres, bandeau)" value={t.couleurPrimaire} onChange={(v) => updateTemplate({ couleurPrimaire: v })} />
              <ColorField label="Couleur accent (alertes, acomptes)" value={t.couleurAccent} onChange={(v) => updateTemplate({ couleurAccent: v })} />
              <ColorField label="Couleur texte principal" value={t.couleurTexte} onChange={(v) => updateTemplate({ couleurTexte: v })} />
            </TabsContent>

            {/* POLICE */}
            <TabsContent value="typo" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-xs">Famille de police</Label>
                <Select value={t.police} onValueChange={(v: any) => updateTemplate({ police: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="helvetica">Helvetica (sans-serif)</SelectItem>
                    <SelectItem value="times">Times (serif)</SelectItem>
                    <SelectItem value="courier">Courier (monospace)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SliderField label="Taille du titre" value={t.tailleTitre} min={14} max={32} step={1} unit="pt" onChange={(v) => updateTemplate({ tailleTitre: v })} />
              <SliderField label="Taille du texte" value={t.tailleTexte} min={6} max={12} step={0.5} unit="pt" onChange={(v) => updateTemplate({ tailleTexte: v })} />
            </TabsContent>

            {/* MARGES */}
            <TabsContent value="mise" className="space-y-4 mt-4">
              <SliderField label="Marge haut" value={t.margeHaut} min={5} max={40} step={1} unit="mm" onChange={(v) => updateTemplate({ margeHaut: v })} />
              <SliderField label="Marge bas" value={t.margeBas} min={5} max={40} step={1} unit="mm" onChange={(v) => updateTemplate({ margeBas: v })} />
              <SliderField label="Marge gauche" value={t.margeGauche} min={5} max={40} step={1} unit="mm" onChange={(v) => updateTemplate({ margeGauche: v })} />
              <SliderField label="Marge droite" value={t.margeDroite} min={5} max={40} step={1} unit="mm" onChange={(v) => updateTemplate({ margeDroite: v })} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Pied de page + options */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" /> Contenu additionnel
          </h3>
          <div className="space-y-2">
            <Label className="text-xs">Pied de page personnalisé</Label>
            <Textarea
              placeholder="Laissez vide pour conserver les mentions légales par défaut"
              value={t.piedDePage}
              onChange={(e) => updateTemplate({ piedDePage: e.target.value })}
              rows={3}
              className="text-xs"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Label className="text-sm font-normal">Afficher le RIB sur les documents</Label>
            <Switch checked={t.afficherRib} onCheckedChange={(v) => updateTemplate({ afficherRib: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Joindre les CGV (page finale)</Label>
            <Switch checked={t.afficherCgv} onCheckedChange={(v) => updateTemplate({ afficherCgv: v })} />
          </div>
          {t.afficherCgv && (
            <div className="space-y-2">
              <Label className="text-xs">Texte des Conditions Générales de Vente</Label>
              <Textarea
                placeholder="Saisissez ici le texte intégral de vos CGV. Il sera ajouté en dernière page des devis et factures."
                value={t.texteCgv}
                onChange={(e) => updateTemplate({ texteCgv: e.target.value })}
                rows={8}
                className="text-xs font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Les CGV occuperont toujours la dernière page du PDF (devis & factures uniquement).
              </p>
            </div>
          )}
        </div>

        <Button onClick={saveToSupabase} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder le template'}
        </Button>
      </div>

      {/* ═══ PANNEAU DROIT — PREVIEW A4 ═══ */}
      <PreviewPane previewType={previewType} setPreviewType={setPreviewType} template={t} entreprise={config.entreprise} totals={totals} />
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-md border border-border cursor-pointer bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

// ─── Aperçu A4 ──────────────────────────────────────────────────────
// On utilise le MÊME composant DocumentTemplate que pour la génération PDF
// → garantit que ce que l'utilisateur voit ici = ce qu'il obtient en PDF.

function buildSampleData(docType: DocType, totals: { ht: number; tva: number; ttc: number }) {
  return {
    ref: docType === 'facture' ? 'FA2025-0042' : docType === 'devis' ? 'PR2025-0042' : 'FI2025-0042',
    date: new Date().toISOString().slice(0, 10),
    type: docType === 'intervention' ? 'Dépannage' : undefined,
    technicien: docType === 'intervention' ? 'Marc Dubois' : undefined,
    description:
      docType === 'intervention'
        ? "Intervention pour remplacement du tableau électrique principal et installation d'un disjoncteur différentiel."
        : undefined,
    client: {
      nom: 'Dupont Jean',
      adresse: '12 rue des Lilas',
      codePostal: '74100',
      ville: 'Annemasse',
      email: 'jean.dupont@example.fr',
      telephone: '06 12 34 56 78',
    },
    lignes: SAMPLE_LIGNES.map((l) => ({
      designation: l.desc,
      ref: l.ref,
      quantite: l.qte,
      unite: 'U',
      prixUnitaire: l.pu,
      tauxTVA: l.tva,
      totalHT: l.qte * l.pu,
    })),
    totaux: {
      ht: totals.ht,
      tva: totals.tva,
      ttc: totals.ttc,
      tvaParTaux: [{ taux: 20, montant: totals.tva }],
    },
  };
}

function PreviewPane({
  previewType,
  setPreviewType,
  template: t,
  entreprise,
  totals,
}: {
  previewType: DocType;
  setPreviewType: (v: DocType) => void;
  template: AppConfig['template'];
  entreprise: AppConfig['entreprise'];
  totals: { ht: number; tva: number; ttc: number };
}) {
  const [zoom, setZoom] = useState(1); // 1 = 100% (vraie taille A4)
  const [openingPdf, setOpeningPdf] = useState(false);
  const A4_W_PX = (210 / 25.4) * 96;

  const data = useMemo(() => buildSampleData(previewType, totals), [previewType, totals]);

  const openFullPdf = async () => {
    setOpeningPdf(true);
    try {
      const url = await documentPdfToBlobUrl({
        docType: previewType as SharedDocType,
        data,
        templateOverride: t,
        entrepriseOverride: entreprise,
      });
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(`Erreur génération PDF : ${e.message || e}`);
    }
    setOpeningPdf(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" /> Aperçu en temps réel
        </div>
        <Tabs value={previewType} onValueChange={(v: any) => setPreviewType(v)}>
          <TabsList>
            <TabsTrigger value="facture">Facture</TabsTrigger>
            <TabsTrigger value="devis">Devis</TabsTrigger>
            <TabsTrigger value="intervention">Bon d'intervention</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Barre de contrôle zoom + plein écran */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg border border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setZoom(1)}>100%</Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setZoom(0.66)}>Ajuster</Button>
        </div>
        <Button onClick={openFullPdf} disabled={openingPdf} size="sm" variant="outline" className="gap-2">
          {openingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
          {openingPdf ? 'Génération...' : 'Ouvrir le PDF A4'}
        </Button>
      </div>

      {/* Conteneur scrollable avec le document à 100% (ou zoom appliqué) */}
      <div
        className="overflow-auto rounded-lg border border-border bg-muted/30 p-6 flex justify-center"
        style={{ maxHeight: '80vh' }}
      >
        <div
          style={{
            width: A4_W_PX * zoom,
            // On applique le zoom via transform pour ne pas redimensionner les enfants un par un
            // (transform-origin top center pour rester centré)
          }}
        >
          <div
            className="shadow-2xl bg-white origin-top"
            style={{
              width: A4_W_PX,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <DocumentTemplate
              docType={previewType as SharedDocType}
              data={data}
              template={t}
              entreprise={entreprise}
              scale={1}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Aperçu à la vraie taille A4 (210 × 297 mm). Cliquez sur « Ouvrir le PDF A4 » pour voir le rendu final dans une nouvelle fenêtre.
      </p>
    </div>
  );
}
