// Générateur PDF — FACTURE — via DocumentTemplate (HTML→PDF, WYSIWYG)
import type { Facture, Client } from '@/services/dolibarr';
import {
  buildDocumentPdf,
  documentPdfToBlobUrl,
  openDocumentPdf,
  downloadDocumentPdf,
  documentPdfToBase64,
} from './htmlToPdf';
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
  const tvaTotal = facture.montantTTC - facture.montantHT;

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
      tva: tvaTotal,
      ttc: facture.montantTTC,
      tvaParTaux: Object.entries(tvaParTaux).map(([taux, montant]) => ({
        taux: Number(taux),
        montant,
      })),
    },
    paye: facture.paye,
    resteAPayer: facture.resteAPayer,
  };
}

export async function openFacturePdf(p: FacturePdfParams): Promise<void> {
  return openDocumentPdf({ docType: 'facture', data: buildData(p), entrepriseOverride: p.entreprise });
}

export async function facturePdfToBlobUrl(p: FacturePdfParams): Promise<string> {
  return documentPdfToBlobUrl({ docType: 'facture', data: buildData(p), entrepriseOverride: p.entreprise });
}

export async function downloadFacturePdf(p: FacturePdfParams): Promise<void> {
  return downloadDocumentPdf(
    { docType: 'facture', data: buildData(p), entrepriseOverride: p.entreprise },
    `${p.facture.ref || 'facture'}.pdf`
  );
}

export async function facturePdfToBase64(p: FacturePdfParams): Promise<string> {
  return documentPdfToBase64({ docType: 'facture', data: buildData(p), entrepriseOverride: p.entreprise });
}

export const buildFacturePdf = async (p: FacturePdfParams) =>
  buildDocumentPdf({ docType: 'facture', data: buildData(p), entrepriseOverride: p.entreprise });
