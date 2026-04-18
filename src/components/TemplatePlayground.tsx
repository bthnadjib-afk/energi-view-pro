import { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, Palette, Type, Maximize2, FileText, Image as ImageIcon, Eye, Save, RotateCcw, Trash2, Loader2 } from 'lucide-react';
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
      police: 'roboto',
      margeHaut: 18,
      margeBas: 20,
      margeGauche: 15,
      margeDroite: 15,
      tailleTitre: 22,
      tailleTexte: 8.5,
      piedDePage: '',
      afficherRib: true,
      afficherCgv: true,
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
                    <SelectItem value="roboto">Roboto</SelectItem>
                    <SelectItem value="montserrat">Montserrat</SelectItem>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="helvetica">Helvetica</SelectItem>
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
            <Label className="text-sm font-normal">Joindre les CGV (page 2 du devis)</Label>
            <Switch checked={t.afficherCgv} onCheckedChange={(v) => updateTemplate({ afficherCgv: v })} />
          </div>
        </div>

        <Button onClick={saveToSupabase} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder le template'}
        </Button>
      </div>

      {/* ═══ PANNEAU DROIT — PREVIEW A4 ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
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

        <A4Preview docType={previewType} template={t} entreprise={config.entreprise} totals={totals} />
        <p className="text-xs text-muted-foreground text-center">
          Aperçu du rendu final. Le PDF généré reprendra ces réglages avec les vraies données client/produits.
        </p>
      </div>
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

function A4Preview({ docType, template: t, entreprise, totals }: { docType: DocType; template: AppConfig['template']; entreprise: AppConfig['entreprise']; totals: { ht: number; tva: number; ttc: number } }) {
  // A4 = 210mm × 297mm — affichage à l'échelle (1mm = ~2.5px pour preview lisible)
  const SCALE = 2.5;
  const W = 210 * SCALE;
  const H = 297 * SCALE;

  const titre = docType === 'facture' ? 'FACTURE' : docType === 'devis' ? 'DEVIS' : "BON D'INTERVENTION";
  const fontFamily = t.police === 'times' ? 'Times, serif' : t.police === 'courier' ? '"Courier New", monospace' : t.police === 'roboto' ? 'Roboto, "Helvetica Neue", Arial, sans-serif' : t.police === 'montserrat' ? 'Montserrat, "Helvetica Neue", Arial, sans-serif' : t.police === 'inter' ? 'Inter, "Helvetica Neue", Arial, sans-serif' : 'Helvetica, Arial, sans-serif';

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateNow = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 flex justify-center" style={{ maxHeight: '80vh' }}>
      <div
        className="bg-white shadow-2xl"
        style={{
          width: W,
          minHeight: H,
          fontFamily,
          color: t.couleurTexte,
          paddingTop: t.margeHaut * SCALE,
          paddingBottom: t.margeBas * SCALE,
          paddingLeft: t.margeGauche * SCALE,
          paddingRight: t.margeDroite * SCALE,
          fontSize: t.tailleTexte * 1.4,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 14 }}>
          {t.logoUrl ? (
            <img src={t.logoUrl} alt="" style={{ height: 38, objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 38, width: 130, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>
              [Logo]
            </div>
          )}
        </div>

        {/* Titre */}
        <div style={{ fontSize: t.tailleTitre, fontWeight: 700, color: t.couleurPrimaire, fontStyle: 'italic', lineHeight: 1.1 }}>
          {titre}
        </div>
        <div style={{ fontSize: 9, color: '#666', fontStyle: 'italic', marginTop: 2, marginBottom: 14 }}>
          NUMÉRO : {docType === 'facture' ? 'FA2025-0042' : docType === 'devis' ? 'PR2025-0042' : 'FI2025-0042'}
        </div>

        {/* Bandeau infos */}
        <div style={{ display: 'flex', background: t.couleurPrimaire, color: '#fff', borderRadius: 2, marginBottom: 14 }}>
          {[
            { l: 'Référence', v: docType === 'facture' ? 'FA2025-0042' : 'PR2025-0042' },
            { l: 'Date', v: dateNow },
            { l: docType === 'facture' ? 'Échéance' : 'Validité', v: docType === 'facture' ? 'À réception' : '30 jours' },
          ].map((c, i) => (
            <div key={i} style={{ flex: 1, padding: '6px 8px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
              <div style={{ fontSize: 7, color: '#bbb', textTransform: 'uppercase' }}>{c.l}</div>
              <div style={{ fontSize: 9, fontWeight: 700 }}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* Parties */}
        <div style={{ display: 'flex', marginBottom: 14, gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontStyle: 'italic', marginBottom: 3, color: t.couleurPrimaire }}>{`{{client.nom}}`}</div>
            <div style={{ fontSize: 9, color: '#333', lineHeight: 1.5 }}>
              <div>{`{{client.adresse}}`}</div>
              <div>{`{{client.codePostal}} {{client.ville}}`}</div>
              <div>{`{{client.email}}`}</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontStyle: 'italic', marginBottom: 3, color: t.couleurPrimaire, textTransform: 'uppercase' }}>
              {entreprise.nom || 'Votre entreprise'}
            </div>
            <div style={{ fontSize: 9, color: '#333', lineHeight: 1.5 }}>
              <div>{entreprise.adresse || '99 Route du Chatelet'}</div>
              <div>{entreprise.codePostal || '74800'} {entreprise.ville || 'Cornier'}</div>
              <div>SIRET : {entreprise.siret || '940 874 936 00013'}</div>
            </div>
          </div>
        </div>

        {/* Tableau */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr style={{ background: t.couleurPrimaire, color: '#fff' }}>
              <th style={{ padding: 4, textAlign: 'left', fontWeight: 700 }}>Description</th>
              <th style={{ padding: 4, textAlign: 'center', fontWeight: 700, width: 50 }}>Qté</th>
              <th style={{ padding: 4, textAlign: 'right', fontWeight: 700, width: 70 }}>P.U.</th>
              <th style={{ padding: 4, textAlign: 'right', fontWeight: 700, width: 80 }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_LIGNES.map((l, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f7f7f7' : '#fff', borderBottom: '0.5px solid #e0e0e0' }}>
                <td style={{ padding: 4 }}>{l.desc}</td>
                <td style={{ padding: 4, textAlign: 'center' }}>{l.qte}</td>
                <td style={{ padding: 4, textAlign: 'right' }}>{fmt(l.pu)} €</td>
                <td style={{ padding: 4, textAlign: 'right', fontWeight: 700 }}>{fmt(l.qte * l.pu)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 200, fontSize: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: '#555', fontStyle: 'italic' }}>TOTAL HT :</span>
              <span style={{ fontWeight: 700 }}>{fmt(totals.ht)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: '#555', fontStyle: 'italic' }}>TVA (20%) :</span>
              <span style={{ fontWeight: 700 }}>{fmt(totals.tva)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1.5px solid ${t.couleurPrimaire}`, marginTop: 4, fontSize: 12 }}>
              <span style={{ fontWeight: 700, fontStyle: 'italic' }}>TOTAL TTC :</span>
              <span style={{ fontWeight: 700, color: t.couleurPrimaire }}>{fmt(totals.ttc)} €</span>
            </div>
          </div>
        </div>

        {/* Acompte (devis seulement) */}
        {docType === 'devis' && (
          <div style={{ marginTop: 14, padding: 8, border: `2px solid ${t.couleurAccent}`, background: `${t.couleurAccent}10`, borderRadius: 4, textAlign: 'center', color: t.couleurAccent, fontSize: 10, fontWeight: 700, fontStyle: 'italic' }}>
            ⚠ ACOMPTE 30 % À PAYER À LA SIGNATURE — SOIT {fmt(totals.ttc * 0.30)} €
          </div>
        )}

        {/* RIB */}
        {t.afficherRib && (
          <div style={{ marginTop: 14, fontSize: 9 }}>
            <div style={{ fontWeight: 700, color: t.couleurPrimaire, marginBottom: 3 }}>Moyens de paiement :</div>
            <div style={{ fontFamily: 'Courier, monospace', color: '#333', lineHeight: 1.6 }}>
              <div>IBAN : FR76 1695 8000 0179 9683 5713 173</div>
              <div>BIC&nbsp;&nbsp;: QNTOFRP1XXX</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 6, borderTop: '0.5px solid #ccc', fontSize: 7, color: '#777', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.6 }}>
          {t.piedDePage || "Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO — Contrat n° 24015161184."}
        </div>
      </div>
    </div>
  );
}
