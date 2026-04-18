/**
 * invoiceRenderer.ts — Fonctions de génération PDF à partir de InvoiceTemplate
 * Charge le logo en data URL avant le rendu pour garantir son affichage.
 */
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoiceDocument } from './InvoiceTemplate';
import type { InvoiceTemplateProps } from './InvoiceTemplate';
// @ts-ignore
import logoUrl from '@/assets/logo.png';

// ─── Charge le logo en data URL (cache en mémoire) ──────────────────────────

let _logoCache: string | null = null;

async function loadLogoDataUrl(): Promise<string> {
  if (_logoCache) return _logoCache;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { _logoCache = reader.result as string; resolve(_logoCache!); };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ─── Génère un Blob PDF ──────────────────────────────────────────────────────

async function buildBlob(params: InvoiceTemplateProps): Promise<Blob> {
  const logoDataUrl = await loadLogoDataUrl();
  const element = React.createElement(InvoiceDocument as any, { ...params, logoDataUrl });
  return pdf(element as any).toBlob();
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Ouvre une dialog de prévisualisation (via blob URL dans iframe) */
export async function invoicePdfToBlobUrl(params: InvoiceTemplateProps): Promise<string> {
  const blob = await buildBlob(params);
  return URL.createObjectURL(blob);
}

/** Ouvre le PDF dans un nouvel onglet */
export async function openInvoicePdf(params: InvoiceTemplateProps): Promise<void> {
  const blob = await buildBlob(params);
  window.open(URL.createObjectURL(blob), '_blank');
}

/** Télécharge le PDF */
export async function downloadInvoicePdf(params: InvoiceTemplateProps): Promise<void> {
  const blob = await buildBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.facture.ref || 'facture'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Retourne le PDF en base64 pur (pièce jointe email) */
export async function invoicePdfToBase64(params: InvoiceTemplateProps): Promise<string> {
  const blob = await buildBlob(params);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
