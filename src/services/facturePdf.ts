// Générateur PDF local — Facture — même design que devisPdf (mix modèle 1 & 2)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Facture, DevisLigne, Client } from '@/services/dolibarr';

// ─── Couleurs ───
const NOIR: [number, number, number] = [15, 15, 15];
const BLEU: [number, number, number] = [30, 64, 175];
const VERT: [number, number, number] = [5, 150, 105];
const GRIS_CLAIR: [number, number, number] = [249, 250, 251];
const GRIS_LIGNE: [number, number, number] = [229, 231, 235];
const GRIS_TEXTE: [number, number, number] = [107, 114, 128];
const JAUNE: [number, number, number] = [234, 179, 8];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const COL_R = PAGE_W - MARGIN;

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function drawLogo(doc: jsPDF, x: number, y: number): void {
  doc.setFillColor(...JAUNE);
  doc.triangle(x + 7, y, x, y + 10, x + 5, y + 10, 'F');
  doc.triangle(x + 3, y + 8, x + 10, y + 8, x + 3, y + 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLEU);
  doc.text('ELECTRICIEN', x + 13, y + 7);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DU GENEVOIS', x + 13, y + 14);
}

export interface FacturePdfParams {
  facture: Facture;
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

function buildFacturePdf({ facture, client, entreprise }: FacturePdfParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGIN;

  // ══════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════
  drawLogo(doc, MARGIN, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...NOIR);
  doc.text('FACTURE', COL_R, y + 8, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`NUMÉRO DE FACTURE : ${facture.ref}`, COL_R, y + 15, { align: 'right' });

  // Statut paiement
  if (facture.paye) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...VERT);
    doc.text('✓ PAYÉE', COL_R, y + 21, { align: 'right' });
  }

  y += 26;

  // ══════════════════════════════════════════════
  // BLOC ADRESSES
  // ══════════════════════════════════════════════
  const colMid = PAGE_W / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text('DESTINATAIRE', MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  doc.text(client?.nom || facture.client || '', MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const clientLines: string[] = [];
  if (client?.adresse) clientLines.push(client.adresse);
  const cityLine = [client?.codePostal, client?.ville].filter(Boolean).join(' ');
  if (cityLine) clientLines.push(cityLine);
  if (client?.email) clientLines.push(client.email);
  if (client?.telephone) clientLines.push(client.telephone);
  clientLines.forEach(line => { doc.text(line, MARGIN, y); y += 4.5; });

  const ent = entreprise;
  const entY0 = y - (clientLines.length * 4.5) - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text('ÉMETTEUR', colMid, entY0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  doc.text((ent?.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase(), colMid, entY0 + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  let ey = entY0 + 10;
  doc.text('AU CAPITAL DE 1 000 €', colMid, ey); ey += 4;
  if (ent?.adresse) { doc.text(ent.adresse.toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.codePostal || ent?.ville) { doc.text(`${ent?.codePostal || ''} ${ent?.ville || ''}`.trim().toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.siret) { doc.text(`SIRET : ${ent.siret} — RCS ANNECY`, colMid, ey); ey += 4; }
  if (ent?.email) { doc.text(ent.email.toUpperCase(), colMid, ey); ey += 4; }
  if (ent?.telephone) { doc.text(ent.telephone, colMid, ey); ey += 4; }

  y = Math.max(y, ey) + 6;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, COL_R, y);
  y += 8;

  // ══════════════════════════════════════════════
  // TABLEAU
  // ══════════════════════════════════════════════
  const lignesMO = facture.lignes.filter(l => l.productType === 'main_oeuvre');
  const lignesFO = facture.lignes.filter(l => l.productType === 'fourniture');

  function buildRows(lignes: DevisLigne[]): any[][] {
    return lignes.map(l => [
      l.designation,
      l.ref,
      String(l.quantite),
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
    colSpan: 7,
  };

  const body: any[] = [];
  if (lignesMO.length > 0) {
    body.push([{ content: "Main d'œuvre", styles: sectionHeaderStyle }]);
    buildRows(lignesMO).forEach(r => body.push(r));
  }
  if (lignesFO.length > 0) {
    body.push([{ content: 'Fournitures', styles: sectionHeaderStyle }]);
    buildRows(lignesFO).forEach(r => body.push(r));
  }
  if (body.length === 0) {
    facture.lignes.forEach(l => body.push(buildRows([l])[0]));
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
  // Date facture
  // ══════════════════════════════════════════════
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`Facture établie le ${formatDateFR(facture.date)}`, MARGIN, y);
  y += 10;

  // ══════════════════════════════════════════════
  // TOTAUX
  // ══════════════════════════════════════════════
  const tvaMap: Record<string, number> = {};
  facture.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const key = `${l.tauxTVA}`;
      tvaMap[key] = (tvaMap[key] || 0) + (l.totalHT * l.tauxTVA / 100);
    }
  });

  const totW = 85;
  const totX = COL_R - totW;
  let totY = y;

  function drawTotalRow(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...NOIR);
    doc.text(label, totX, totY);
    doc.text(value, COL_R, totY, { align: 'right' });
    totY += 5.5;
  }

  drawTotalRow('TOTAL HT :', `${fmt(facture.montantHT)} €`);
  Object.entries(tvaMap).forEach(([taux, montant]) => {
    drawTotalRow(`TVA (${taux}%) :`, `${fmt(montant)} €`);
  });
  if (Object.keys(tvaMap).length === 0) {
    const tva = facture.montantTTC - facture.montantHT;
    drawTotalRow('TVA :', `${fmt(tva)} €`);
  }

  totY += 2;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(totX, totY, COL_R, totY);
  totY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...NOIR);
  doc.text('NET À PAYER :', totX, totY);
  doc.text(`${fmt(facture.montantTTC)} €`, COL_R, totY, { align: 'right' });
  totY += 7;

  if (facture.resteAPayer > 0 && !facture.paye) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text(`Reste à payer : ${fmt(facture.resteAPayer)} €`, COL_R, totY, { align: 'right' });
    totY += 6;
  }

  if (facture.paye) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...VERT);
    doc.text('✓ FACTURE PAYÉE', COL_R, totY, { align: 'right' });
    totY += 7;
  }

  y = Math.max(y + 10, totY) + 6;

  // ══════════════════════════════════════════════
  // MOYENS DE PAIEMENT
  // ══════════════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NOIR);
  doc.text('Moyens de paiement :', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('IBAN : FR76 1695 8000 0179 9683 5713 173', MARGIN, y + 6);
  doc.text('BIC : QNTOFRP1XXX', MARGIN, y + 11);

  y += 18;

  // ══════════════════════════════════════════════
  // PIED DE PAGE
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

export function openFacturePdf(params: FacturePdfParams): void {
  const doc = buildFacturePdf(params);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Génère une URL blob pour afficher dans un iframe (pas bloqué par popup blocker) */
export function facturePdfToBlobUrl(params: FacturePdfParams): string {
  const doc = buildFacturePdf(params);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function downloadFacturePdf(params: FacturePdfParams): void {
  const doc = buildFacturePdf(params);
  doc.save(`${params.facture.ref}.pdf`);
}

export function facturePdfToBase64(params: FacturePdfParams): string {
  const doc = buildFacturePdf(params);
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
