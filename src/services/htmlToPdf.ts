/**
 * htmlToPdf.ts — Génération PDF à partir du composant React DocumentTemplate.
 *
 * Pipeline :
 *   1. Render off-screen le DocumentTemplate à largeur A4 (≈794px @96dpi).
 *   2. Auto-fit densité : on tente de rentrer sur 1 page A4 en réduisant
 *      progressivement la densité (1.0 → 0.6).
 *   3. Si même à densité min ça déborde, on bascule en MULTI-PAGE :
 *      on capture le contenu complet et on le découpe en pages A4.
 *   4. Si CGV activées, on AJOUTE TOUJOURS une dernière page dédiée aux CGV.
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
// Largeur CSS A4 STRICTE à 96dpi (pixel-to-point)
const TEMPLATE_W_PX = 794;        // = round((210 / 25.4) * 96)
const TEMPLATE_H_PX = 1123;       // = round((297 / 25.4) * 96)
const RENDER_SCALE = 1;
const MAX_DENSITY = 1;
// Garde-fou : ne JAMAIS descendre sous 0.85 pour préserver la lisibilité.
// Si à 0.85 le contenu dépasse encore, on bascule en MULTI-PAGE plutôt
// que de continuer à miniaturiser le texte.
const MIN_DENSITY = 0.85;
const DENSITY_STEP = 0.05;
// 300 DPI : scale = 300/96 = 3.125 → canvas 2481px large pour 210mm → 300 DPI exact dans le PDF.
const RENDER_DPR = 3.125;

// ─── Lecture config ───────────────────────────────────────────────────────────
function readTemplateCfg(): DocumentTemplateCfg {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('electropro-config');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const tpl = (parsed?.template as DocumentTemplateCfg) || {};
    const def = parsed?.defaults || {};
    // Merge acompte settings from defaults into template cfg
    if (def.tauxAcompte          !== undefined) tpl.tauxAcompte          = def.tauxAcompte;
    if (def.seuilAcompte         !== undefined) tpl.seuilAcompte         = def.seuilAcompte;
    if (def.tauxAcompteSeuilDepasse !== undefined) tpl.tauxAcompteSeuilDepasse = def.tauxAcompteSeuilDepasse;
    return tpl;
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

// ─── URL → dataURL (CORS safe) ────────────────────────────────────────────────
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
    return url;
  }
}

// ─── Helper : crée un host off-screen STRICTEMENT à largeur A4 (pixel-to-point) ─
// La largeur peut être surchargée via le slider de debug "captureWidth" en Préférences.
function createHost(widthPx: number = TEMPLATE_W_PX): { host: HTMLElement; root: Root } {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '-10000px';
  host.style.width = `${widthPx}px`;             // configurable
  host.style.height = 'fit-content';            // pas de contrainte verticale
  host.style.overflow = 'hidden';               // empêche tout débordement parasite
  host.style.background = '#fff';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.transform = 'none';                // aucune transformation
  host.style.zoom = '1' as string;              // aucun zoom navigateur
  host.style.zIndex = '-1';
  document.body.appendChild(host);
  const root = createRoot(host);
  return { host, root };
}

function destroyHost(host: HTMLElement, root: Root) {
  try { root.unmount(); } catch { /* noop */ }
  if (host.parentNode) host.parentNode.removeChild(host);
}

async function waitForImages(host: HTMLElement) {
  const imgs = Array.from(host.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(() => resolve(), 2000);
      });
    })
  );
}

// ─── Render principal : auto-fit densité + capture ────────────────────────────
interface MainCaptureResult {
  canvas: HTMLCanvasElement;
  /** Hauteur réelle du contenu (en px CSS). */
  contentHeightPx: number;
  /** Densité finale retenue. */
  density: number;
  /** True si le contenu a dû être étalé sur plusieurs pages. */
  multiPage: boolean;
}

async function renderMain(props: DocumentTemplateProps): Promise<MainCaptureResult> {
  // Largeur de capture configurable depuis Préférences (debug zoom).
  // Bornée 700-1200, défaut 794 (A4 strict @ 96dpi).
  const captureW = Math.min(1200, Math.max(700, Math.round(props.template.captureWidth ?? TEMPLATE_W_PX)));
  // Hauteur "page" proportionnelle à la largeur de capture pour rester en ratio A4.
  const captureH = Math.round((captureW * A4_H_MM) / A4_W_MM);

  const { host, root } = createHost(captureW);
  try {
    // 1. Auto-fit densité jusqu'à rentrer sur A4
    let density = MAX_DENSITY;
    const measure = async (d: number): Promise<number> => {
      root.render(
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
    while (needed > captureH && density > MIN_DENSITY) {
      density = Math.max(MIN_DENSITY, +(density - DENSITY_STEP).toFixed(2));
      needed = await measure(density);
    }

    const multiPage = needed > captureH;

    // 2. Render final
    //    - Single page : on contraint à A4 (overflow hidden).
    //    - Multi page : on garde autoHeight pour capturer tout le contenu.
    root.render(
      createElement(DocumentTemplate, {
        ...props,
        scale: RENDER_SCALE,
        density,
        autoHeight: multiPage,
      })
    );
    await new Promise((r) => setTimeout(r, 80));
    await waitForImages(host);

    const target = host.firstElementChild as HTMLElement;
    const finalHeight = multiPage ? target.scrollHeight : captureH;

    const canvas = await html2canvas(target, {
      scale: RENDER_DPR,         // 300 DPI (3.125 × 96dpi)
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 4000,
      width: captureW,
      height: finalHeight,
      windowWidth: captureW,
      windowHeight: finalHeight,
    });

    return { canvas, contentHeightPx: finalHeight, density, multiPage };
  } finally {
    destroyHost(host, root);
  }
}

// ─── Render dédié : page CGV uniquement ───────────────────────────────────────
async function renderCgv(props: DocumentTemplateProps): Promise<HTMLCanvasElement> {
  const { host, root } = createHost();
  try {
    root.render(
      createElement(DocumentTemplate, {
        ...props,
        scale: RENDER_SCALE,
        density: 1,
        autoHeight: false,
        cgvOnly: true,
      })
    );
    await new Promise((r) => setTimeout(r, 80));
    await waitForImages(host);

    const target = host.firstElementChild as HTMLElement;
    return await html2canvas(target, {
      scale: RENDER_DPR,          // 300 DPI (3.125 × 96dpi)
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: TEMPLATE_W_PX,
      height: TEMPLATE_H_PX,
      windowWidth: TEMPLATE_W_PX,
      windowHeight: TEMPLATE_H_PX,
    });
  } finally {
    destroyHost(host, root);
  }
}

// ─── Ajoute un canvas à un PDF en le découpant en pages A4 ────────────────────
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, isFirstPage: boolean) {
  // Hauteur d'une "page A4" exprimée en px du canvas courant (ratio A4 strict).
  const pageHeightPxAt1 = Math.round((canvas.width * A4_H_MM) / A4_W_MM);

  // ─── Cas 1 : tout tient sur UNE page A4 → écrasement strict 210×297mm ───
  if (canvas.height <= pageHeightPxAt1 + 2) {
    if (!isFirstPage) pdf.addPage();
    const imgData = canvas.toDataURL('image/png');
    // FORÇAGE PHYSIQUE : on impose 210×297mm, peu importe la taille pixel.
    // → annule tout effet de zoom / scaling parasite.
    pdf.addImage(imgData, 'PNG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST');
    return;
  }

  // ─── Cas 2 : multi-page → on découpe en tranches A4 strictes ───
  const sliceHeightPx = pageHeightPxAt1;
  let yOffset = 0;
  let firstSlice = true;
  while (yOffset < canvas.height) {
    const remaining = canvas.height - yOffset;
    const currentSliceHeight = Math.min(sliceHeightPx, remaining);

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = currentSliceHeight;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0, yOffset, canvas.width, currentSliceHeight,
      0, 0, canvas.width, currentSliceHeight
    );

    if (!firstSlice || !isFirstPage) pdf.addPage();
    // Tranche pleine = 297mm, tranche partielle = proportionnelle (jamais étirée).
    const heightMm = (currentSliceHeight / sliceHeightPx) * A4_H_MM;
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, heightMm, undefined, 'FAST');

    yOffset += currentSliceHeight;
    firstSlice = false;
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────
export interface BuildDocumentPdfParams {
  docType: DocType;
  data: DocumentTemplateData;
  templateOverride?: DocumentTemplateCfg;
  entrepriseOverride?: EntrepriseInfo;
}

export async function buildDocumentPdf(params: BuildDocumentPdfParams): Promise<jsPDF> {
  const template = params.templateOverride ?? readTemplateCfg();
  const entreprise = params.entrepriseOverride ?? readEntreprise();

  // Pré-charge logo en dataURL
  const logoSrc = template.logoUrl || (logoFallback as unknown as string);
  const logoDataUrl = await urlToDataUrl(logoSrc);
  const tplWithLogo: DocumentTemplateCfg = { ...template, logoUrl: logoDataUrl };

  // Pré-charge signatures éventuelles
  const data = { ...params.data };
  if (data.signatureClient && !data.signatureClient.startsWith('data:')) {
    data.signatureClient = await urlToDataUrl(data.signatureClient);
  }
  if (data.signatureTech && !data.signatureTech.startsWith('data:')) {
    data.signatureTech = await urlToDataUrl(data.signatureTech);
  }

  // 1. Rendu du document principal
  const main = await renderMain({
    docType: params.docType,
    data,
    template: tplWithLogo,
    entreprise,
    scale: 1,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  addCanvasToPdf(pdf, main.canvas, true);

  // 2. Page CGV finale (devis & facture, si activée + texte fourni)
  const wantsCgv =
    (params.docType === 'devis' || params.docType === 'facture') &&
    template.afficherCgv !== false &&
    !!(template.texteCgv && template.texteCgv.trim().length > 0);

  if (wantsCgv) {
    const cgvCanvas = await renderCgv({
      docType: params.docType,
      data,
      template: tplWithLogo,
      entreprise,
      scale: 1,
    });
    addCanvasToPdf(pdf, cgvCanvas, false);
  }

  return pdf;
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
