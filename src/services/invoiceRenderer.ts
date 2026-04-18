/**
 * invoiceRenderer.ts — Façade vers le générateur jsPDF (facturePdf.ts)
 */
import {
  openFacturePdf,
  facturePdfToBlobUrl,
  downloadFacturePdf,
  facturePdfToBase64,
  type FacturePdfParams,
} from './facturePdf';

// Compat : ancien type InvoiceTemplateProps
export type InvoiceTemplateProps = FacturePdfParams;

export const invoicePdfToBlobUrl = (p: InvoiceTemplateProps) => facturePdfToBlobUrl(p);
export const openInvoicePdf      = (p: InvoiceTemplateProps) => openFacturePdf(p);
export const downloadInvoicePdf  = (p: InvoiceTemplateProps) => downloadFacturePdf(p);
export const invoicePdfToBase64  = (p: InvoiceTemplateProps) => facturePdfToBase64(p);
