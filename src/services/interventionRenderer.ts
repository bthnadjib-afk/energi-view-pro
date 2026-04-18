/**
 * interventionRenderer.ts — Façade vers le générateur jsPDF (interventionPdf.ts)
 */
import {
  generateInterventionPdfLocal,
  generateInterventionPdfBlobUrl,
  generateInterventionPdfBase64,
  type InterventionPdfParams,
} from './interventionPdf';

export type InterventionRendererParams = InterventionPdfParams;

export const interventionPdfToBlobUrl = (p: InterventionRendererParams) => generateInterventionPdfBlobUrl(p);
export const downloadInterventionPdf  = (p: InterventionRendererParams) => generateInterventionPdfLocal(p);
export const interventionPdfToBase64  = (p: InterventionRendererParams) => generateInterventionPdfBase64(p);
export const openInterventionPdf      = async (p: InterventionRendererParams) => {
  const url = await generateInterventionPdfBlobUrl(p);
  window.open(url, '_blank');
};
