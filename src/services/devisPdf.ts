// Générateur PDF local — Devis — design mix modèle 1 & 2
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Devis, DevisLigne, Client } from '@/services/dolibarr';

// ─── Couleurs ───
const NOIR: [number, number, number] = [15, 15, 15];
const BLEU: [number, number, number] = [30, 64, 175];
const ROUGE: [number, number, number] = [185, 28, 28];
const ROUGE_BG: [number, number, number] = [254, 242, 242];
const GRIS_CLAIR: [number, number, number] = [249, 250, 251];
const GRIS_LIGNE: [number, number, number] = [229, 231, 235];
const GRIS_TEXTE: [number, number, number] = [107, 114, 128];
const JAUNE: [number, number, number] = [234, 179, 8];

// ─── Constantes mise en page ───
const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const COL_R = PAGE_W - MARGIN; // bord droit

// ─── Helpers ───
function fmt(n: number | null | undefined): string {
  const num = typeof n === 'number' && isFinite(n) ? n : 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toText(value: unknown): string {
  return value == null ? '' : String(value);
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Dessine le logo ELECTRICIEN DU GENEVOIS avec un éclair stylisé */
function drawLogo(doc: jsPDF, x: number, y: number): void {
  const boltX = x;
  const boltY = y;
  doc.setFillColor(...JAUNE);
  doc.triangle(boltX + 7, boltY, boltX, boltY + 10, boltX + 5, boltY + 10, 'F');
  doc.triangle(boltX + 3, boltY + 8, boltX + 10, boltY + 8, boltX + 3, boltY + 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLEU);
  doc.text('ELECTRICIEN', boltX + 13, boltY + 7);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DU GENEVOIS', boltX + 13, boltY + 14);
}

export interface DevisPdfParams {
  devis: Devis;
  client?: Client;
  entreprise?: {
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    siret: string;
    telephone: string;
    email: string;
  };
}

function buildDevisPdf({ devis, client, entreprise }: DevisPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGIN;

  drawLogo(doc, MARGIN, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...NOIR);
  doc.text('DEVIS', COL_R, y + 8, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`NUMÉRO DE DEVIS : ${toText(devis.ref)}`, COL_R, y + 15, { align: 'right' });

  y += 26;
  const colMid = PAGE_W / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text('DESTINATAIRE', MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  const clientNom = toText(client?.nom || devis.client || '');
  doc.text(clientNom, MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const clientLines: string[] = [];
  if (client?.adresse) clientLines.push(toText(client.adresse));
  const cityLine = [client?.codePostal, client?.ville].filter(Boolean).map(toText).join(' ');
  if (cityLine) clientLines.push(cityLine);
  if (client?.email) clientLines.push(toText(client.email));
  if (client?.telephone) clientLines.push(toText(client.telephone));
  clientLines.forEach(line => { doc.text(toText(line), MARGIN, y); y += 4.5; });

  const ent = entreprise;
  const entY0 = y - (clientLines.length * 4.5) - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text('ÉMETTEUR', colMid, entY0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  const entNom = toText(ent?.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase();
  doc.text(entNom, colMid, entY0 + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  let ey = entY0 + 10;
  doc.text('AU CAPITAL DE 1 000 €', colMid, ey); ey += 4;
  if (ent?.adresse) { doc.text(toText(ent.adresse).toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.codePostal || ent?.ville) { doc.text(`${toText(ent?.codePostal)} ${toText(ent?.ville)}`.trim().toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.siret) { doc.text(`SIRET : ${toText(ent.siret)} — RCS ANNECY`, colMid, ey); ey += 4; }
  if (ent?.email) { doc.text(toText(ent.email).toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.telephone) { doc.text(toText(ent.telephone), colMid, ey); ey += 4; }

  // Séparateur horizontal
  y = Math.max(y, ey) + 6;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, COL_R, y);
  y += 8;

  // ══════════════════════════════════════════════
  // TABLEAU DES LIGNES (en-tête noir, sections)
  // ══════════════════════════════════════════════
  const lignesMO = devis.lignes.filter(l => l.productType === 'main_oeuvre');
  const lignesFO = devis.lignes.filter(l => l.productType === 'fourniture');

  function buildRows(lignes: DevisLigne[]): (string | { content: string; styles: object })[][] {
    return lignes.map(l => [
      String(l.designation || ''),
      String(l.ref || ''),
      String(l.quantite ?? ''),
      l.unite || 'U',
      `${fmt(l.prixUnitaire)} €`,
      `${l.tauxTVA}%`,
      `${fmt(l.totalHT)} €`,
    ]);
  }

  const sectionHeaderStyle = {
    fillColor: [243, 244, 246] as [number, number, number],
    textColor: BLEU,
    fontStyle: 'bold' as const,
  };

  const body: any[] = [];
  if (lignesMO.length > 0) {
    body.push([{ content: "Main d'œuvre", colSpan: 7, styles: sectionHeaderStyle }]);
    buildRows(lignesMO).forEach(r => body.push(r));
  }
  if (lignesFO.length > 0) {
    body.push([{ content: 'Fournitures', colSpan: 7, styles: sectionHeaderStyle }]);
    buildRows(lignesFO).forEach(r => body.push(r));
  }
  if (body.length === 0) {
    devis.lignes.forEach(l => body.push(buildRows([l])[0]));
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Description', 'Réf', 'Qté', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: NOIR,
      lineColor: GRIS_LIGNE,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 15, 15],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [15, 15, 15],
    },
    alternateRowStyles: { fillColor: GRIS_CLAIR },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as any).lastAutoTable?.finalY || y + 20;
  y += 6;

  // ══════════════════════════════════════════════
  // Date validité
  // ══════════════════════════════════════════════
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRIS_TEXTE);
  const dateStr = formatDateFR(devis.date);
  const validStr = devis.finValidite ? formatDateFR(devis.finValidite) : '30 jours à compter de cette date';
  doc.text(`Devis établi le ${dateStr} | Valable ${validStr}`, MARGIN, y);
  y += 10;

  // ══════════════════════════════════════════════
  // TOTAUX (droite) + ACOMPTE (droite sous NET)
  // ══════════════════════════════════════════════

  // Calculer TVA par taux
  const tvaMap: Record<string, number> = {};
  devis.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const key = `${l.tauxTVA}`;
      tvaMap[key] = (tvaMap[key] || 0) + (l.totalHT * l.tauxTVA / 100);
    }
  });

  const totW = 85;
  const totX = COL_R - totW;
  let totY = y;

  function drawTotalRow(label: string, value: string, bold = false, large = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(large ? 11 : 9);
    doc.setTextColor(...NOIR);
    doc.text(label, totX, totY);
    doc.text(value, COL_R, totY, { align: 'right' });
    totY += large ? 8 : 5.5;
  }

  drawTotalRow('TOTAL HT :', `${fmt(devis.montantHT)} €`);
  Object.entries(tvaMap).forEach(([taux, montant]) => {
    drawTotalRow(`TVA (${taux}%) :`, `${fmt(montant)} €`);
  });
  if (Object.keys(tvaMap).length === 0) {
    const tva = devis.montantTTC - devis.montantHT;
    drawTotalRow('TVA :', `${fmt(tva)} €`);
  }

  totY += 2;

  // Ligne de séparation avant NET
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(totX, totY, COL_R, totY);
  totY += 5;

  // NET À PAYER — grand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NOIR);
  doc.text('NET À PAYER :', totX, totY);
  doc.text(`${fmt(devis.montantTTC)} €`, COL_R, totY, { align: 'right' });
  totY += 10;

  // Acompte box rouge
  const tauxAcompte = devis.montantHT > 5000 ? 30 : 50;
  const montantAcompte = Math.round(devis.montantTTC * tauxAcompte) / 100;
  const boxH = 16;
  doc.setFillColor(...ROUGE_BG);
  doc.setDrawColor(...ROUGE);
  doc.setLineWidth(0.5);
  doc.roundedRect(totX, totY, totW, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...ROUGE);
  doc.text(`⚠  ACOMPTE ${tauxAcompte}% À PAYER À LA SIGNATURE`, totX + totW / 2, totY + 6, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`SOIT ${fmt(montantAcompte)} €`, totX + totW / 2, totY + 13, { align: 'center' });
  totY += boxH + 4;

  y = Math.max(y + 10, totY) + 6;

  // ══════════════════════════════════════════════
  // SIGNATURE (gauche) + MOYENS DE PAIEMENT
  // ══════════════════════════════════════════════
  const sigW = 82;
  const sigH = 28;
  const sigX = MARGIN;

  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.3);
  // @ts-ignore - jsPDF setLineDashPattern exists at runtime
  (doc as any).setLineDashPattern?.([2, 2], 0);
  doc.roundedRect(sigX, y, sigW, sigH, 2, 2, 'S');
  // @ts-ignore
  (doc as any).setLineDashPattern?.([], 0);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text("* Signature précédée de la mention 'bon pour accord' :", sigX + 3, y + 6);

  // Moyens de paiement (droite de la signature)
  const payX = MARGIN + sigW + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NOIR);
  doc.text('Moyens de paiement :', payX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('IBAN : FR76 1695 8000 0179 9683 5713 173', payX, y + 11);
  doc.text('BIC : QNTOFRP1XXX', payX, y + 16);

  y += sigH + 10;

  // ══════════════════════════════════════════════
  // PIED DE PAGE LÉGAL
  // ══════════════════════════════════════════════
  const footY = PAGE_H - 18;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footY - 4, COL_R, footY - 4);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS_TEXTE);
  const legal = [
    'Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d\'ERGO — Contrat n° 24015161184.',
    'Les matériaux et équipements restent la propriété de l\'entreprise jusqu\'au paiement intégral de la facture (art. 2367 du Code civil).',
    'Tout retard de paiement entraînera des pénalités de 10% par an et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).',
  ];
  legal.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, footY + i * 4, { align: 'center' });
  });

  return doc;
}

/** Ouvre le PDF dans un nouvel onglet */
export function openDevisPdf(params: DevisPdfParams): void {
  const doc = buildDevisPdf(params);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Génère une URL blob pour afficher dans un iframe (pas bloqué par popup blocker) */
export function devisPdfToBlobUrl(params: DevisPdfParams): string {
  const doc = buildDevisPdf(params);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/** Télécharge directement le PDF */
export function downloadDevisPdf(params: DevisPdfParams): void {
  const doc = buildDevisPdf(params);
  doc.save(`${params.devis.ref}.pdf`);
}

/** Retourne le PDF en base64 (pour envoi email) */
export function devisPdfToBase64(params: DevisPdfParams): string {
  const doc = buildDevisPdf(params);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
