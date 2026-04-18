/**
 * interventionRenderer.ts — Façade vers le générateur jsPDF (interventionPdf.ts)
 */
import {
  openInterventionPdf as _open,
  interventionPdfToBlobUrl as _blob,
  downloadInterventionPdf as _download,
  interventionPdfToBase64 as _b64,
  type InterventionPdfParams,
} from './interventionPdf';

export type InterventionRendererParams = InterventionPdfParams;

export const interventionPdfToBlobUrl = (p: InterventionRendererParams) => _blob(p);
export const openInterventionPdf      = (p: InterventionRendererParams) => _open(p);
export const downloadInterventionPdf  = (p: InterventionRendererParams) => _download(p);
export const interventionPdfToBase64  = (p: InterventionRendererParams) => _b64(p);
