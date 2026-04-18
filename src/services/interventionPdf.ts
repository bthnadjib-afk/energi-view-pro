// Générateur PDF — BON D'INTERVENTION — ELECTRICIEN DU GENEVOIS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Intervention, Client, InterventionLine } from '@/services/dolibarr';
import {
  ML, MR, MT, PAGE_W, PAGE_H, COL_R, CW,
  NOIR, BLANC, GRIS_CLAIR, GRIS_LIGNE, GRIS_TEXTE, GRIS_SOMBRE,
  toText, formatDateFR,
  loadRobotoFonts, setFont,
  drawLogo, drawInfoBar, drawParties, drawFooter,
  type EntrepriseInfo, type ClientInfo,
} from './pdfUtils';

const TYPE_LABELS: Record<string, string> = {
  devis: 'Établissement devis',
  panne: 'Dépannage',
  panne_urgence: 'Urgence',
  sav: 'SAV / Garantie',
  chantier: 'Chantier',
};

export interface InterventionPdfParams {
  intervention: Intervention;
  client?: Client;
  lines: InterventionLine[];
  signatureClient?: string;
  signatureTech?: string;
  entreprise?: EntrepriseInfo;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

async function buildInterventionPdf({
  intervention, client, lines, entreprise, signatureClient, signatureTech,
}: InterventionPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadRobotoFonts(doc);
  let y = MT;

  // ─── LOGO ────────────────────────────────────────────────────
  const logoH = await drawLogo(doc, ML, y);
  y += logoH + 7;

  // ─── TITRE ───────────────────────────────────────────────────
  setFont(doc, 'bolditalic');
  doc.setFontSize(22);
  doc.setTextColor(...NOIR);
  doc.text("BON D'INTERVENTION", ML, y);
  y += 6;

  setFont(doc, 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`RÉFÉRENCE : ${toText(intervention.ref)}`, ML, y);
  y += 8;

  // ─── BARRE INFO ───────────────────────────────────────────────
  const barH = drawInfoBar(doc, y, [
    { label: 'Référence',   value: toText(intervention.ref) },
    { label: 'Date',        value: formatDateFR(intervention.date) },
    { label: 'Type',        value: TYPE_LABELS[intervention.type] || toText(intervention.type) },
    { label: 'Technicien',  value: toText(intervention.technicien || '—') },
  ]);
  y += barH + 8;

  // ─── CLIENT / ENTREPRISE ──────────────────────────────────────
  const clientInfo: ClientInfo = {
    nom:        client?.nom || intervention.client,
    adresse:    client?.adresse,
    codePostal: client?.codePostal,
    ville:      client?.ville,
    email:      client?.email,
    telephone:  client?.telephone,
  };
  y = drawParties(doc, y, clientInfo, entreprise) + 8;

  // ─── DESCRIPTION INTERVENTION ────────────────────────────────
  if (intervention.description) {
    // Titre section
    setFont(doc, 'bolditalic');
    doc.setFontSize(9.5);
    doc.setTextColor(...NOIR);
    doc.text('Description', ML, y);
    y += 2;
    doc.setDrawColor(...GRIS_LIGNE);
    doc.setLineWidth(0.3);
    doc.line(ML, y, COL_R, y);
    y += 5;

    setFont(doc, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(34, 34, 34);
    const descLines = doc.splitTextToSize(toText(intervention.description), CW);
    doc.text(descLines, ML, y);
    y += descLines.length * 4.5 + 6;
  }

  // ─── TABLEAU DES LIGNES ───────────────────────────────────────
  if (lines && lines.length > 0) {
    setFont(doc, 'bolditalic');
    doc.setFontSize(9.5);
    doc.setTextColor(...NOIR);
    doc.text("Lignes d'intervention", ML, y);
    y += 2;
    doc.setDrawColor(...GRIS_LIGNE);
    doc.setLineWidth(0.3);
    doc.line(ML, y, COL_R, y);
    y += 4;

    const totalDuration = lines.reduce((sum, l) => sum + (l.duree || 0), 0);

    autoTable(doc, {
      startY: y, margin: { left: ML, right: MR },
      head: [['#', 'Description', 'Date', 'Durée']],
      body: lines.map((line, i) => [
        String(i + 1),
        toText(line.description || ''),
        formatDateFR(line.date),
        formatDuration(line.duree || 0),
      ]),
      foot: totalDuration > 0
        ? [['', { content: 'TOTAL HEURES', styles: { fontStyle: 'bolditalic' as const } }, '', formatDuration(totalDuration)]]
        : undefined,
      theme: 'grid',
      styles: {
        fontSize: 8.5, font: 'helvetica',
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor: NOIR, lineColor: GRIS_LIGNE, lineWidth: 0.3,
      },
      headStyles: { fillColor: NOIR, textColor: BLANC, fontStyle: 'bold', font: 'helvetica' },
      footStyles: { fillColor: GRIS_CLAIR, textColor: NOIR, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: GRIS_CLAIR },
      columnStyles: {
        0: { cellWidth: 10,  halign: 'center' },
        1: { cellWidth: 120 },
        2: { cellWidth: 28,  halign: 'center' },
        3: { cellWidth: 22,  halign: 'center', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 20;
    y += 8;
  }

  // ─── SÉPARATEUR ───────────────────────────────────────────────
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(ML, y, COL_R, y);
  y += 8;

  // ─── SIGNATURES (côte à côte) ────────────────────────────────
  const sigW  = (CW - 10) / 2;
  const sigH  = 28;
  const sig2X = ML + sigW + 10;

  // Box Technicien
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.5);
  doc.rect(ML, y, sigW, sigH, 'S');
  setFont(doc, 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_SOMBRE);
  doc.text('Signature du technicien :', ML + 3, y + 6);
  if (signatureTech) {
    try { doc.addImage(signatureTech, 'PNG', ML + 2, y + 8, sigW - 4, sigH - 12); } catch {}
  }

  // Box Client
  doc.rect(sig2X, y, sigW, sigH, 'S');
  setFont(doc, 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_SOMBRE);
  doc.text("Signature du client (bon pour accord) :", sig2X + 3, y + 6);
  if (signatureClient) {
    try { doc.addImage(signatureClient, 'PNG', sig2X + 2, y + 8, sigW - 4, sigH - 12); } catch {}
  }

  y += sigH + 8;

  // ─── OBSERVATIONS ────────────────────────────────────────────
  if ((intervention as any).observations) {
    setFont(doc, 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(...NOIR);
    doc.text('Observations :', ML, y);
    y += 5;
    setFont(doc, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_SOMBRE);
    const obsLines = doc.splitTextToSize(toText((intervention as any).observations), CW);
    doc.text(obsLines, ML, y);
  }

  // ─── FOOTER ───────────────────────────────────────────────────
  drawFooter(doc);

  return doc;
}

// ─── API publique (async) ─────────────────────────────────────

export async function generateInterventionPdfLocal(params: InterventionPdfParams): Promise<void> {
  const doc = await buildInterventionPdf(params);
  doc.save(`${params.intervention.ref || 'intervention'}.pdf`);
}

export async function generateInterventionPdfBlobUrl(params: InterventionPdfParams): Promise<string> {
  const doc = await buildInterventionPdf(params);
  return URL.createObjectURL(doc.output('blob'));
}

export async function generateInterventionPdfBase64(params: InterventionPdfParams): Promise<string> {
  const doc = await buildInterventionPdf(params);
  return doc.output('datauristring').split(',')[1];
}
