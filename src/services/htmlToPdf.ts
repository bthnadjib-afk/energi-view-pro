/**
 * htmlToPdf.ts — Génération PDF à partir du composant React DocumentTemplate.
 *
 * Stratégie : "WYSIWYG"
 *   1. Render le composant DocumentTemplate dans un container caché (off-screen)
 *      avec une largeur fixe = 210mm en pixels CSS (1mm = 1px à scale=1).
 *   2. Capture le DOM avec html2canvas (rendu identique sur tous appareils).
 *   3. Découpe l'image en pages A4 et génère le PDF avec jsPDF.
 *
 * Avantages :
 *   - Le rendu PDF est strictement identique au playground.
 *   - Aucune police custom à charger (utilise les fonts système).
 *   - Fonctionne sur web/mobile/serveur sans problème de Buffer ou CORS de fonts.
 */
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  DocumentTemplate,
  type DocumentTemplateProps,
  type DocumentTemplateData,
  type DocumentTemplateCfg,
  type DocType,
  type EntrepriseInfo,
} from './DocumentTemplate';
import logoFallback from '@/assets/logo.png';

// A4 cible dans le PDF final (mm)
const A4_W_MM = 210;
const A4_H_MM = 297;
// Le template a été construit avec une grille "virtuelle" 210×297 en pixels CSS.
// On le rend sur une vraie largeur A4 CSS (~794px à 96dpi) pour éviter tout zoom.
const TEMPLATE_W_PX = (A4_W_MM / 25.4) * 96;       // ≈ 794 px
const TEMPLATE_H_PX = (A4_H_MM / 25.4) * 96;       // ≈ 1123 px
const RENDER_SCALE = 1;
// Densité max (= aucune compression visuelle). On descend si ça déborde.
const MAX_DENSITY = 1;
const MIN_DENSITY = 0.6;
const DENSITY_STEP = 0.05;
// Capture nette sans regonfler artificiellement le layout.
const RENDER_DPR = 3;

// ─── Lecture config template depuis localStorage ─────────────────────────────
function readTemplateCfg(): DocumentTemplateCfg {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('electropro-config');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed?.template as DocumentTemplateCfg) || {};
  } catch {
    return {};
  }
}

function readEntreprise(): EntrepriseInfo {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('electropro-config');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed?.entreprise as EntrepriseInfo) || {};
  } catch {
    return {};
  }
}

// ─── Convertir une URL image en dataURL pour éviter les soucis CORS ────────────
const _imgCache = new Map<string, string>();
async function urlToDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (_imgCache.has(url)) return _imgCache.get(url)!;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    _imgCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return url; // fallback : utiliser l'URL telle quelle
  }
}

// ─── Render off-screen + capture html2canvas ───────────────────────────────────
async function renderToCanvas(props: DocumentTemplateProps): Promise<HTMLCanvasElement> {
  // Container off-screen — visible dans le DOM mais positionné hors écran
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '-10000px';
  host.style.width = `${TEMPLATE_W_PX}px`;
  host.style.background = '#fff';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    // ─── Auto-fit : on cherche la plus grande densité qui tient sur A4.
    //   1. On rend une fois SANS contrainte de hauteur pour mesurer le vrai
    //      besoin du contenu à densité 1.
    //   2. Si ça déborde A4, on réduit la densité par paliers jusqu'à ce
    //      que le contenu rentre — sans jamais descendre sous MIN_DENSITY.
    let density = MAX_DENSITY;
    const measure = async (d: number): Promise<number> => {
      root!.render(
        createElement(DocumentTemplate, {
          ...props,
          scale: RENDER_SCALE,
          density: d,
          autoHeight: true,
        })
      );
      await new Promise((r) => setTimeout(r, 60));
      const el = host.firstElementChild as HTMLElement;
      return el?.scrollHeight ?? 0;
    };

    let needed = await measure(density);
    while (needed > TEMPLATE_H_PX && density > MIN_DENSITY) {
      density = Math.max(MIN_DENSITY, +(density - DENSITY_STEP).toFixed(2));
      needed = await measure(density);
    }

    // Render final à la densité retenue, contraint à la hauteur A4.
    root.render(
      createElement(DocumentTemplate, {
        ...props,
        scale: RENDER_SCALE,
        density,
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    // Attendre le décodage des images (logo, signatures)
    const imgs = Array.from(host.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          // Sécurité : timeout 2s
          setTimeout(() => resolve(), 2000);
        });
      })
    );

    const target = host.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: RENDER_DPR,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 4000,
      width: TEMPLATE_W_PX,
      height: TEMPLATE_H_PX,
      windowWidth: TEMPLATE_W_PX,
      windowHeight: TEMPLATE_H_PX,
    });
    return canvas;
  } finally {
    if (root) {
      try { root.unmount(); } catch { /* noop */ }
    }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}

// ─── Découpage canvas en pages A4 et build du PDF ─────────────────────────────
function canvasToPdf(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, A4_W_MM, A4_H_MM);
  return pdf;
}

// ─── API publique : générer un jsPDF complet à partir des params ──────────────
export interface BuildDocumentPdfParams {
  docType: DocType;
  data: DocumentTemplateData;
  /** Override config template (sinon lue depuis localStorage). */
  templateOverride?: DocumentTemplateCfg;
  /** Override entreprise (sinon lue depuis localStorage). */
  entrepriseOverride?: EntrepriseInfo;
}

export async function buildDocumentPdf(params: BuildDocumentPdfParams): Promise<jsPDF> {
  const template = params.templateOverride ?? readTemplateCfg();
  const entreprise = params.entrepriseOverride ?? readEntreprise();

  // Pré-charger le logo en dataURL pour éviter les soucis CORS lors du capture
  const logoSrc = template.logoUrl || (logoFallback as unknown as string);
  const logoDataUrl = await urlToDataUrl(logoSrc);
  const tplWithLogo: DocumentTemplateCfg = { ...template, logoUrl: logoDataUrl };

  // Idem pour les signatures intervention (souvent dataURL déjà, mais sécurité)
  const data = { ...params.data };
  if (data.signatureClient && !data.signatureClient.startsWith('data:')) {
    data.signatureClient = await urlToDataUrl(data.signatureClient);
  }
  if (data.signatureTech && !data.signatureTech.startsWith('data:')) {
    data.signatureTech = await urlToDataUrl(data.signatureTech);
  }

  const canvas = await renderToCanvas({
    docType: params.docType,
    data,
    template: tplWithLogo,
    entreprise,
    scale: 1,
  });
  return canvasToPdf(canvas);
}

// ─── Helpers pratiques ────────────────────────────────────────────────────────
export async function documentPdfToBlobUrl(p: BuildDocumentPdfParams): Promise<string> {
  const pdf = await buildDocumentPdf(p);
  return URL.createObjectURL(pdf.output('blob'));
}

export async function openDocumentPdf(p: BuildDocumentPdfParams): Promise<void> {
  const url = await documentPdfToBlobUrl(p);
  window.open(url, '_blank');
}

export async function downloadDocumentPdf(p: BuildDocumentPdfParams, filename: string): Promise<void> {
  const pdf = await buildDocumentPdf(p);
  pdf.save(filename);
}

export async function documentPdfToBase64(p: BuildDocumentPdfParams): Promise<string> {
  const pdf = await buildDocumentPdf(p);
  return pdf.output('datauristring').split(',')[1];
}
