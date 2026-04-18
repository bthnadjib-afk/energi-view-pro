// Générateur PDF — DEVIS — via DocumentTemplate (HTML→PDF, WYSIWYG)
import type { Devis, Client } from '@/services/dolibarr';
import {
  buildDocumentPdf,
  documentPdfToBlobUrl,
  openDocumentPdf,
  downloadDocumentPdf,
  documentPdfToBase64,
} from './htmlToPdf';
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
  const tvaTotal = devis.montantTTC - devis.montantHT;

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
      tva: tvaTotal,
      ttc: devis.montantTTC,
      tvaParTaux: Object.entries(tvaParTaux).map(([taux, montant]) => ({
        taux: Number(taux),
        montant,
      })),
    },
  };
}

export async function openDevisPdf(p: DevisPdfParams): Promise<void> {
  return openDocumentPdf({ docType: 'devis', data: buildData(p), entrepriseOverride: p.entreprise });
}

export async function devisPdfToBlobUrl(p: DevisPdfParams): Promise<string> {
  return documentPdfToBlobUrl({ docType: 'devis', data: buildData(p), entrepriseOverride: p.entreprise });
}

export async function downloadDevisPdf(p: DevisPdfParams): Promise<void> {
  return downloadDocumentPdf(
    { docType: 'devis', data: buildData(p), entrepriseOverride: p.entreprise },
    `${p.devis.ref || 'devis'}.pdf`
  );
}

export async function devisPdfToBase64(p: DevisPdfParams): Promise<string> {
  return documentPdfToBase64({ docType: 'devis', data: buildData(p), entrepriseOverride: p.entreprise });
}

// Compat avec d'anciens imports éventuels
export const buildDevisPdf = async (p: DevisPdfParams) =>
  buildDocumentPdf({ docType: 'devis', data: buildData(p), entrepriseOverride: p.entreprise });
