// Générateur PDF — DEVIS — ELECTRICIEN DU GENEVOIS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Devis, DevisLigne, Client } from '@/services/dolibarr';
import {
  ML, MR, MT, PAGE_W, PAGE_H, COL_R, CW,
  NOIR, BLANC, GRIS_CLAIR, GRIS_LIGNE, GRIS_TEXTE,
  TPL_SHOW_RIB, TPL_SHOW_CGV,
  fmt, toText, formatDateFR,
  loadRobotoFonts, setFont,
  drawLogo, drawInfoBar, drawParties, drawTotaux,
  drawSignatureAndNet, drawRib, drawFooter, drawCGV,
  type EntrepriseInfo, type ClientInfo,
} from './pdfUtils';

export interface DevisPdfParams {
  devis: Devis;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

async function buildDevisPdf({ devis, client, entreprise }: DevisPdfParams): Promise<jsPDF> {
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
  doc.text('DEVIS', ML, y);
  y += 6;

  setFont(doc, 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`NUMÉRO DE DEVIS : ${toText(devis.ref)}`, ML, y);
  y += 8;

  // ─── BARRE INFO ───────────────────────────────────────────────
  const barH = drawInfoBar(doc, y, [
    { label: 'Référence', value: toText(devis.ref) },
    { label: 'Date',      value: formatDateFR(devis.date) },
  ]);
  y += barH + 8;

  // ─── CLIENT / ENTREPRISE ──────────────────────────────────────
  const clientInfo: ClientInfo = {
    nom:       client?.nom || devis.client,
    adresse:   client?.adresse,
    codePostal: client?.codePostal,
    ville:      client?.ville,
    email:      client?.email,
    telephone:  client?.telephone,
  };
  y = drawParties(doc, y, clientInfo, entreprise) + 10;

  // ─── TABLEAU DES LIGNES ───────────────────────────────────────
  const lignesMO = devis.lignes.filter(l => l.productType === 'main_oeuvre');
  const lignesFO = devis.lignes.filter(l => l.productType === 'fourniture');

  function buildRows(lignes: DevisLigne[]) {
    return lignes.map(l => [
      toText(l.designation || ''),
      { content: toText(l.ref || ''), styles: { halign: 'center' as const, textColor: [120,120,120] as [number,number,number] } },
      { content: toText(l.quantite ?? ''), styles: { halign: 'center' as const } },
      { content: l.unite || 'U', styles: { halign: 'center' as const } },
      { content: `${fmt(l.prixUnitaire)} €`, styles: { halign: 'right' as const } },
      { content: `${l.tauxTVA}%`, styles: { halign: 'center' as const } },
      { content: `${fmt(l.totalHT)} €`, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
    ]);
  }

  const sectionStyle = {
    fillColor: [255,255,255] as [number,number,number],
    textColor: NOIR,
    fontStyle: 'bolditalic' as const,
    fontSize: 9,
    cellPadding: { top: 3, bottom: 1, left: 2, right: 2 },
  };

  const body: any[] = [];
  if (lignesMO.length > 0) {
    body.push([{ content: "Main d'œuvre", colSpan: 7, styles: sectionStyle }]);
    buildRows(lignesMO).forEach(r => body.push(r));
  }
  if (lignesFO.length > 0) {
    body.push([{ content: 'Fournitures', colSpan: 7, styles: sectionStyle }]);
    buildRows(lignesFO).forEach(r => body.push(r));
  }
  if (body.length === 0) {
    devis.lignes.forEach(l => buildRows([l]).forEach(r => body.push(r)));
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['Description', 'Réf', 'Qté', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8.5, font: 'helvetica',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: NOIR, lineColor: GRIS_LIGNE, lineWidth: 0.3,
    },
    headStyles: {
      fillColor: NOIR, textColor: BLANC, fontStyle: 'bold',
      fontSize: 8.5, font: 'helvetica', lineColor: NOIR,
    },
    alternateRowStyles: { fillColor: GRIS_CLAIR },
    columnStyles: {
      0: { cellWidth: 80,  halign: 'left' },
      1: { cellWidth: 16,  halign: 'center' },
      2: { cellWidth: 11,  halign: 'center' },
      3: { cellWidth: 12,  halign: 'center' },
      4: { cellWidth: 23,  halign: 'right' },
      5: { cellWidth: 13,  halign: 'center' },
      6: { cellWidth: 25,  halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable?.finalY || y + 20;

  // ─── SÉPARATEUR ───────────────────────────────────────────────
  y += 5;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(ML, y, COL_R, y);
  y += 6;

  // ─── DATE (gauche) + TOTAUX (droite) ─────────────────────────
  setFont(doc, 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`Devis établi le ${formatDateFR(devis.date)}`, ML, y);
  doc.text('La présente offre est valable sous réserve de disponibilité des fournitures.', ML, y + 4.5);

  // Calcul TVA par taux
  const tvaMap: Record<string, number> = {};
  devis.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const key = `${l.tauxTVA}`;
      tvaMap[key] = (tvaMap[key] || 0) + (l.totalHT * l.tauxTVA / 100);
    }
  });

  const totRows: { label: string; value: string; large?: boolean }[] = [
    { label: 'TOTAL HT :', value: `${fmt(devis.montantHT)} €` },
  ];
  if (Object.keys(tvaMap).length > 0) {
    Object.entries(tvaMap).forEach(([taux, montant]) =>
      totRows.push({ label: `TVA (${taux}%) :`, value: `${fmt(montant)} €` })
    );
  } else {
    totRows.push({ label: 'TVA :', value: `${fmt(devis.montantTTC - devis.montantHT)} €` });
  }

  const totEndY = drawTotaux(doc, y, totRows);
  y = Math.max(y + 14, totEndY) + 6;

  // ─── SIGNATURE + NET À PAYER ──────────────────────────────────
  const acompte = Math.round(devis.montantTTC * 0.30 * 100) / 100;
  y = drawSignatureAndNet(
    doc, y,
    'NET À PAYER', `${fmt(devis.montantTTC)} €`,
    '⚠  ACOMPTE 30 % À PAYER À LA SIGNATURE', `SOIT ${fmt(acompte)} €`
  ) + 8;

  // ─── RIB ──────────────────────────────────────────────────────
  if (TPL_SHOW_RIB) {
    y = drawRib(doc, y) + 2;
  }

  // ─── FOOTER ───────────────────────────────────────────────────
  drawFooter(doc);

  // ─── CGV (page 2) ─────────────────────────────────────────────
  if (TPL_SHOW_CGV) {
    drawCGV(doc);
  }

  return doc;
}

// ─── API publique ─────────────────────────────────────────────

export async function openDevisPdf(params: DevisPdfParams): Promise<void> {
  const doc = await buildDevisPdf(params);
  window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

export async function devisPdfToBlobUrl(params: DevisPdfParams): Promise<string> {
  const doc = await buildDevisPdf(params);
  return URL.createObjectURL(doc.output('blob'));
}

export async function downloadDevisPdf(params: DevisPdfParams): Promise<void> {
  const doc = await buildDevisPdf(params);
  doc.save(`${params.devis.ref}.pdf`);
}

export async function devisPdfToBase64(params: DevisPdfParams): Promise<string> {
  const doc = await buildDevisPdf(params);
  return doc.output('datauristring').split(',')[1];
}
