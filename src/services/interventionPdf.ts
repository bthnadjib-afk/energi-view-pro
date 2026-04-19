// Générateur PDF — BON D'INTERVENTION — via @react-pdf/renderer (vectoriel)
import type { Intervention, Client, InterventionLine } from '@/services/dolibarr';
import { buildPdfBlob, buildPdfBase64, openPdf, downloadPdf, pdfToBlobUrl } from './reactPdf';
import type { DocumentTemplateData, EntrepriseInfo } from './DocumentTemplate';

export type { EntrepriseInfo } from './DocumentTemplate';

const TYPE_LABELS: Record<string, string> = {
  devis: 'Établissement devis',
  panne: 'Dépannage',
  panne_urgence: 'Urgence',
  sav: 'SAV / Garantie',
  chantier: 'Chantier',
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export interface InterventionPdfParams {
  intervention: Intervention;
  client?: Client;
  lines: InterventionLine[];
  signatureClient?: string;
  signatureTech?: string;
  entreprise?: EntrepriseInfo;
}

function buildData({
  intervention,
  client,
  lines,
  signatureClient,
  signatureTech,
}: InterventionPdfParams): DocumentTemplateData {
  const lignes = (lines || []).map((l, i) => ({
    designation: l.description || `Ligne ${i + 1}`,
    ref: '',
    quantite: 1,
    unite: '',
    prixUnitaire: 0,
    tauxTVA: 0,
    totalHT: 0,
  }));

  const totalDuration = (lines || []).reduce((s, l) => s + (l.duree || 0), 0);
  const totalDurationLabel = totalDuration > 0 ? `\n\nTotal heures : ${formatDuration(totalDuration)}` : '';

  return {
    ref: intervention.ref,
    date: intervention.date,
    type: TYPE_LABELS[intervention.type] || intervention.type,
    technicien: intervention.technicien || '—',
    client: {
      nom: client?.nom || intervention.client,
      adresse: client?.adresse,
      codePostal: client?.codePostal,
      ville: client?.ville,
      email: client?.email,
      telephone: client?.telephone,
    },
    lignes,
    totaux: { ht: 0, tva: 0, ttc: 0 },
    description: (intervention.description || '') + totalDurationLabel,
    observations: (intervention as any).compteRendu || (intervention as any).observations || '',
    signatureClient,
    signatureTech,
  };
}

const p2params = (p: InterventionPdfParams) => ({
  docType: 'intervention' as const,
  data: buildData(p),
  entrepriseOverride: p.entreprise,
});

export const generateInterventionPdfLocal    = (p: InterventionPdfParams) => downloadPdf(p2params(p), `${p.intervention.ref || 'intervention'}.pdf`);
export const generateInterventionPdfBlobUrl  = (p: InterventionPdfParams) => pdfToBlobUrl(p2params(p));
export const generateInterventionPdfBase64   = (p: InterventionPdfParams) => buildPdfBase64(p2params(p));
export const openInterventionPdf             = (p: InterventionPdfParams) => openPdf(p2params(p));
export const downloadInterventionPdf         = generateInterventionPdfLocal;
export const interventionPdfToBlobUrl        = generateInterventionPdfBlobUrl;
export const interventionPdfToBase64         = generateInterventionPdfBase64;
