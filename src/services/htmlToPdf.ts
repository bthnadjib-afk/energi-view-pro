/**
 * htmlToPdf.ts — Génération PDF à partir du composant React DocumentTemplate.
 *
 * Pipeline :
 *   1. Render off-screen le DocumentTemplate à largeur A4 (≈794px @96dpi)
 *      avec autoHeight=true et density=1 (échelle fixe, pas de réduction).
 *   2. Le contenu est capturé en entier, puis découpé en tranches A4 strictes.
 *   3. Chaque page reçoit un numéro "x/total" en bas à gauche (si > 1 page).
 *   4. Si CGV activées, une dernière page dédiée aux CGV est ajoutée.
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
    if (def.devise               !== undefined) tpl.devise               = def.devise;
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

// ─── Helper : crée un host rendu par le navigateur (même qualité que le template preview) ─
// opacity:0 + pointerEvents:none = invisible pour l'utilisateur mais rendu natif complet par le browser.
// position:fixed top:0 left:0 = dans le viewport → le navigateur calcule tous les styles correctement
// (contrairement à un élément off-screen qui peut être optimisé différemment).
function createHost(widthPx: number = TEMPLATE_W_PX): { host: HTMLElement; root: Root } {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = `${widthPx}px`;
  host.style.height = 'auto';
  host.style.overflow = 'visible';
  host.style.background = '#fff';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.transform = 'none';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-9999';
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

// ─── Render principal : échelle fixe (density=1), capture complète ────────────
interface MainCaptureResult {
  canvas: HTMLCanvasElement;
  contentHeightPx: number;
  multiPage: boolean;
}

async function renderMain(props: DocumentTemplateProps): Promise<MainCaptureResult> {
  const captureW = Math.min(1200, Math.max(700, Math.round(props.template.captureWidth ?? TEMPLATE_W_PX)));
  const captureH = Math.round((captureW * A4_H_MM) / A4_W_MM);

  const { host, root } = createHost(captureW);
  try {
    // Render with density=1 and autoHeight=true — no scaling, always multi-page if needed
    root.render(
      createElement(DocumentTemplate, {
        ...props,
        scale: RENDER_SCALE,
        density: 1,
        autoHeight: true,
      })
    );
    // Attendre le rendu React + fonts + images
    await new Promise((r) => setTimeout(r, 120));
    await document.fonts.ready;
    await waitForImages(host);

    const target = host.firstElementChild as HTMLElement;
    const contentHeight = target?.scrollHeight ?? captureH;
    const multiPage = contentHeight > captureH;

    const canvas = await html2canvas(target, {
      scale: RENDER_DPR,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 4000,
      width: captureW,
      height: contentHeight,
      windowWidth: captureW,
      windowHeight: contentHeight,
    });

    return { canvas, contentHeightPx: contentHeight, multiPage };
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
    await new Promise((r) => setTimeout(r, 120));
    await document.fonts.ready;
    await waitForImages(host);

    const target = host.firstElementChild as HTMLElement;
    return await html2canvas(target, {
      scale: RENDER_DPR,
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

// ─── Numéro de page en bas à gauche ──────────────────────────────────────────
function addPageNumber(pdf: jsPDF, pageNum: number, totalPages: number, pageHeightMm: number) {
  if (totalPages <= 1) return;
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  pdf.text(`${pageNum}/${totalPages}`, A4_W_MM - 10, pageHeightMm - 5, { align: 'right' });
}

// ─── Ajoute un canvas à un PDF en le découpant en pages A4 ────────────────────
function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirstPage: boolean,
  startPageNum: number,
  totalPages: number,
) {
  const pageHeightPxAt1 = Math.round((canvas.width * A4_H_MM) / A4_W_MM);

  // ─── Cas 1 : tout tient sur UNE page A4 ───
  if (canvas.height <= pageHeightPxAt1 + 2) {
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST');
    addPageNumber(pdf, startPageNum, totalPages, A4_H_MM);
    return;
  }

  // ─── Cas 2 : multi-page → on découpe en tranches A4 strictes ───
  const sliceHeightPx = pageHeightPxAt1;
  let yOffset = 0;
  let firstSlice = true;
  let pageNum = startPageNum;

  while (yOffset < canvas.height) {
    const remaining = canvas.height - yOffset;
    const currentSliceHeight = Math.min(sliceHeightPx, remaining);

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = currentSliceHeight;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, yOffset, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

    if (!firstSlice || !isFirstPage) pdf.addPage();
    const heightMm = (currentSliceHeight / sliceHeightPx) * A4_H_MM;
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, heightMm, undefined, 'FAST');
    addPageNumber(pdf, pageNum, totalPages, heightMm);

    yOffset += currentSliceHeight;
    firstSlice = false;
    pageNum++;
  }
}

// ─── Nombre de pages qu'un canvas génère ─────────────────────────────────────
function countPages(canvas: HTMLCanvasElement): number {
  const pageHeightPx = Math.round((canvas.width * A4_H_MM) / A4_W_MM);
  return Math.ceil(canvas.height / pageHeightPx);
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

  const logoSrc = template.logoUrl || (logoFallback as unknown as string);
  const logoDataUrl = await urlToDataUrl(logoSrc);
  const tplWithLogo: DocumentTemplateCfg = { ...template, logoUrl: logoDataUrl };

  const data = { ...params.data };
  if (data.signatureClient && !data.signatureClient.startsWith('data:')) {
    data.signatureClient = await urlToDataUrl(data.signatureClient);
  }
  if (data.signatureTech && !data.signatureTech.startsWith('data:')) {
    data.signatureTech = await urlToDataUrl(data.signatureTech);
  }

  const wantsCgv =
    (params.docType === 'devis' || params.docType === 'facture') &&
    template.afficherCgv !== false &&
    !!(template.texteCgv && template.texteCgv.trim().length > 0);

  const sharedProps: DocumentTemplateProps = {
    docType: params.docType,
    data,
    template: tplWithLogo,
    entreprise,
    scale: 1,
  };

  // 1. Rendu du document principal
  const main = await renderMain(sharedProps);

  // 2. Calcul du nombre total de pages (pour numérotation)
  const mainPageCount = countPages(main.canvas);
  const totalPages = mainPageCount + (wantsCgv ? 1 : 0);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  addCanvasToPdf(pdf, main.canvas, true, 1, totalPages);

  // 3. Page CGV finale
  if (wantsCgv) {
    const cgvCanvas = await renderCgv(sharedProps);
    addCanvasToPdf(pdf, cgvCanvas, false, mainPageCount + 1, totalPages);
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
