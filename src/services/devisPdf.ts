// Générateur PDF — DEVIS — via @react-pdf/renderer (vectoriel)
import type { Devis, Client } from '@/services/dolibarr';
import { buildPdfBlob, buildPdfBase64, openPdf, downloadPdf, pdfToBlobUrl } from './reactPdf';
import type { DocumentTemplateData, EntrepriseInfo } from './DocumentTemplate';

export type { EntrepriseInfo } from './DocumentTemplate';

export interface DevisPdfParams {
  devis: Devis;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

function buildData({ devis, client }: DevisPdfParams): DocumentTemplateData {
  const lignes = (devis.lignes || []).map((l) => ({
    designation: l.designation || '',
    ref: l.ref || '',
    quantite: Number(l.quantite ?? 0),
    unite: l.unite || 'U',
    prixUnitaire: Number(l.prixUnitaire ?? 0),
    tauxTVA: Number(l.tauxTVA ?? 0),
    totalHT: Number(l.totalHT ?? 0),
  }));

  const tvaParTaux: Record<string, number> = {};
  lignes.forEach((l) => {
    if (l.tauxTVA > 0) {
      tvaParTaux[String(l.tauxTVA)] = (tvaParTaux[String(l.tauxTVA)] || 0) + (l.totalHT * l.tauxTVA) / 100;
    }
  });

  return {
    ref: devis.ref,
    date: devis.date,
    validite: devis.finValidite,
    client: {
      nom: client?.nom || devis.client,
      adresse: client?.adresse,
      codePostal: client?.codePostal,
      ville: client?.ville,
      email: client?.email,
      telephone: client?.telephone,
    },
    lignes,
    totaux: {
      ht: devis.montantHT,
      tva: devis.montantTTC - devis.montantHT,
      ttc: devis.montantTTC,
      tvaParTaux: Object.entries(tvaParTaux).map(([taux, montant]) => ({ taux: Number(taux), montant })),
    },
  };
}

const p2params = (p: DevisPdfParams) => ({ docType: 'devis' as const, data: buildData(p), entrepriseOverride: p.entreprise });

export const openDevisPdf      = (p: DevisPdfParams) => openPdf(p2params(p));
export const devisPdfToBlobUrl = (p: DevisPdfParams) => pdfToBlobUrl(p2params(p));
export const downloadDevisPdf  = (p: DevisPdfParams) => downloadPdf(p2params(p), `${p.devis.ref || 'devis'}.pdf`);
export const devisPdfToBase64  = (p: DevisPdfParams) => buildPdfBase64(p2params(p));
export const buildDevisPdf     = (p: DevisPdfParams) => buildPdfBlob(p2params(p));
