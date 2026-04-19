// Générateur PDF — FACTURE — via @react-pdf/renderer (vectoriel)
import type { Facture, Client } from '@/services/dolibarr';
import { buildPdfBlob, buildPdfBase64, openPdf, downloadPdf, pdfToBlobUrl } from './reactPdf';
import type { DocumentTemplateData, EntrepriseInfo } from './DocumentTemplate';

export type { EntrepriseInfo } from './DocumentTemplate';

export interface FacturePdfParams {
  facture: Facture;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

function buildData({ facture, client }: FacturePdfParams): DocumentTemplateData {
  const lignes = (facture.lignes || []).map((l) => ({
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
    ref: facture.ref,
    date: facture.date,
    echeance: (facture as any).echeance,
    client: {
      nom: client?.nom || facture.client,
      adresse: client?.adresse,
      codePostal: client?.codePostal,
      ville: client?.ville,
      email: client?.email,
      telephone: client?.telephone,
    },
    lignes,
    totaux: {
      ht: facture.montantHT,
      tva: facture.montantTTC - facture.montantHT,
      ttc: facture.montantTTC,
      tvaParTaux: Object.entries(tvaParTaux).map(([taux, montant]) => ({ taux: Number(taux), montant })),
    },
    paye: facture.paye,
    resteAPayer: facture.resteAPayer,
  };
}

const p2params = (p: FacturePdfParams) => ({ docType: 'facture' as const, data: buildData(p), entrepriseOverride: p.entreprise });

export const openFacturePdf      = (p: FacturePdfParams) => openPdf(p2params(p));
export const facturePdfToBlobUrl = (p: FacturePdfParams) => pdfToBlobUrl(p2params(p));
export const downloadFacturePdf  = (p: FacturePdfParams) => downloadPdf(p2params(p), `${p.facture.ref || 'facture'}.pdf`);
export const facturePdfToBase64  = (p: FacturePdfParams) => buildPdfBase64(p2params(p));
export const buildFacturePdf     = (p: FacturePdfParams) => buildPdfBlob(p2params(p));
