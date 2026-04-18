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

// A4 en mm
const A4_W_MM = 210;
const A4_H_MM = 297;
// Échelle d'affichage du DocumentTemplate pour le rendu PDF.
// Le composant utilise des "unités" qui représentent des mm. On les rend
// en pixels CSS via PX_PER_MM pour matcher une vraie page A4 (96dpi).
const PX_PER_MM = 96 / 25.4; // ≈ 3.7795
const RENDER_SCALE = PX_PER_MM; // passé au composant comme scale
const A4_W_PX = A4_W_MM * PX_PER_MM; // ≈ 794
const A4_H_PX = A4_H_MM * PX_PER_MM; // ≈ 1123
// Densité de capture html2canvas pour la netteté
const RENDER_DPR = 2;

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
  host.style.width = `${A4_W_MM}px`;
  host.style.background = '#fff';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    // Render synchronisé puis attente d'un cycle pour garantir layout + images
    root.render(createElement(DocumentTemplate, { ...props, scale: 1 }));
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

    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: RENDER_DPR,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 4000,
      windowWidth: A4_W_MM,
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
  // ratio px↔mm
  const pxPerMm = canvas.width / A4_W_MM; // largeur canvas / largeur A4
  const pageHeightPx = Math.floor(A4_H_MM * pxPerMm);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = canvas.width;
  pageCanvas.height = pageHeightPx;
  const pageCtx = pageCanvas.getContext('2d')!;

  for (let p = 0; p < totalPages; p++) {
    const sy = p * pageHeightPx;
    const sliceHeight = Math.min(pageHeightPx, canvas.height - sy);
    pageCtx.fillStyle = '#ffffff';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.drawImage(
      canvas,
      0, sy, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight
    );
    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (p > 0) pdf.addPage();
    // Hauteur réelle imprimée en mm (pour la dernière page < pleine hauteur)
    const printedHeightMm = (sliceHeight / pxPerMm);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, printedHeightMm);
  }
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
