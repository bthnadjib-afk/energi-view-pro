/**
 * devisRenderer.ts — Façade vers le générateur jsPDF (devisPdf.ts)
 * On garde l'API publique pour compat avec les pages, mais on délègue
 * à jsPDF qui supporte la config template (couleurs, marges, logo, RIB...).
 */
import {
  openDevisPdf as _open,
  devisPdfToBlobUrl as _blob,
  downloadDevisPdf as _download,
  devisPdfToBase64 as _b64,
  type DevisPdfParams,
} from './devisPdf';

export type DevisRendererParams = DevisPdfParams;

export const devisPdfToBlobUrl = (p: DevisRendererParams) => _blob(p);
export const openDevisPdf      = (p: DevisRendererParams) => _open(p);
export const downloadDevisPdf  = (p: DevisRendererParams) => _download(p);
export const devisPdfToBase64  = (p: DevisRendererParams) => _b64(p);
