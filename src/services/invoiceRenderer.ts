/**
 * invoiceRenderer.ts — Fonctions de génération PDF à partir de InvoiceTemplate
 * Utilise @react-pdf/renderer pdf() pour produire blob / base64 / téléchargement
 */
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoiceDocument } from './InvoiceTemplate';
import type { InvoiceTemplateProps } from './InvoiceTemplate';

/** Génère un Blob PDF */
async function buildBlob(params: InvoiceTemplateProps): Promise<Blob> {
  const element = React.createElement(InvoiceDocument, params);
  return pdf(element).toBlob();
}

/** Ouvre le PDF dans un nouvel onglet */
export async function openInvoicePdf(params: InvoiceTemplateProps): Promise<void> {
  const blob = await buildBlob(params);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Retourne une Blob URL (pour prévisualisation iframe) */
export async function invoicePdfToBlobUrl(params: InvoiceTemplateProps): Promise<string> {
  const blob = await buildBlob(params);
  return URL.createObjectURL(blob);
}

/** Télécharge le PDF directement */
export async function downloadInvoicePdf(params: InvoiceTemplateProps): Promise<void> {
  const blob = await buildBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.facture.ref || 'facture'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Retourne le PDF en base64 pur (pour pièce jointe email) */
export async function invoicePdfToBase64(params: InvoiceTemplateProps): Promise<string> {
  const blob = await buildBlob(params);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Retire le préfixe "data:application/pdf;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
