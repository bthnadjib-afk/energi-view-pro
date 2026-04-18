// Générateur PDF — FACTURE — ELECTRICIEN DU GENEVOIS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Facture, DevisLigne, Client } from '@/services/dolibarr';
import {
  ML, MR, MT, PAGE_W, PAGE_H, COL_R, CW,
  NOIR, BLANC, GRIS_CLAIR, GRIS_LIGNE, GRIS_TEXTE,
  ROUGE, ROUGE_BG, TPL_SHOW_RIB,
  fmt, toText, formatDateFR,
  loadRobotoFonts, setFont,
  drawLogo, drawInfoBar, drawParties, drawTotaux,
  drawSignatureAndNet,
  drawRib, drawFooter,
  type EntrepriseInfo, type ClientInfo,
} from './pdfUtils';

const VERT: [number,number,number] = [22, 163, 74];

export interface FacturePdfParams {
  facture: Facture;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

async function buildFacturePdf({ facture, client, entreprise }: FacturePdfParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadRobotoFonts(doc);
  let y = MT;

  // ─── LOGO ────────────────────────────────────────────────────
  const logoH = await drawLogo(doc, ML, y);
  y += logoH + 7;

  // ─── TITRE ───────────────────────────────────────────────────
  // Détermine le type de facture
  const isAcompte  = (facture as any).type === 'acompte'  || facture.ref?.includes('ACOMPTE');
  const isSolde    = (facture as any).type === 'solde'    || facture.ref?.includes('SOLDE');
  const isAvoir    = (facture as any).type === 'avoir';
  const titre = isAcompte ? "FACTURE D'ACOMPTE"
              : isSolde   ? 'FACTURE DE SOLDE'
              : isAvoir   ? "AVOIR"
              : 'FACTURE';

  setFont(doc, 'bolditalic');
  doc.setFontSize(22);
  doc.setTextColor(...NOIR);
  doc.text(titre, ML, y);
  y += 6;

  setFont(doc, 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(`NUMÉRO : ${toText(facture.ref)}`, ML, y);
  y += 8;

  // ─── BARRE INFO ───────────────────────────────────────────────
  const barCells = [
    { label: 'Référence', value: toText(facture.ref) },
    { label: 'Date de facture', value: formatDateFR(facture.date) },
    { label: 'Échéance', value: (facture as any).echeance ? formatDateFR((facture as any).echeance) : 'À réception' },
  ];
  if (facture.paye) {
    barCells.push({ label: 'Statut', value: '✓ PAYÉE' });
  }
  const barH = drawInfoBar(doc, y, barCells.slice(0, 3));
  y += barH + 8;

  // ─── CLIENT / ENTREPRISE ──────────────────────────────────────
  const clientInfo: ClientInfo = {
    nom:        client?.nom || facture.client,
    adresse:    client?.adresse,
    codePostal: client?.codePostal,
    ville:      client?.ville,
    email:      client?.email,
    telephone:  client?.telephone,
  };
  y = drawParties(doc, y, clientInfo, entreprise) + 10;

  // ─── TABLEAU ──────────────────────────────────────────────────
  const lignesMO = facture.lignes.filter(l => l.productType === 'main_oeuvre');
  const lignesFO = facture.lignes.filter(l => l.productType === 'fourniture');

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
    textColor: NOIR, fontStyle: 'bolditalic' as const,
    fontSize: 9, cellPadding: { top: 3, bottom: 1, left: 2, right: 2 },
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
    facture.lignes.forEach(l => buildRows([l]).forEach(r => body.push(r)));
  }

  autoTable(doc, {
    startY: y, margin: { left: ML, right: MR },
    head: [['Description', 'Réf', 'Qté', 'Unité', 'Prix unitaire', 'TVA', 'Montant']],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8.5, font: 'helvetica',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: NOIR, lineColor: GRIS_LIGNE, lineWidth: 0.3,
    },
    headStyles: { fillColor: NOIR, textColor: BLANC, fontStyle: 'bold', fontSize: 8.5, font: 'helvetica' },
    alternateRowStyles: { fillColor: GRIS_CLAIR },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 16,     halign: 'center' },
      2: { cellWidth: 11,     halign: 'center' },
      3: { cellWidth: 12,     halign: 'center' },
      4: { cellWidth: 23,     halign: 'right' },
      5: { cellWidth: 13,     halign: 'center' },
      6: { cellWidth: 25,     halign: 'right' },
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
  doc.text(`Date de la facture : ${formatDateFR(facture.date)}`, ML, y);
  if (isAcompte) {
    doc.text('La présente facture correspond à un acompte de 30 %.', ML, y + 4.5);
  }

  // Calcul TVA
  const tvaMap: Record<string, number> = {};
  facture.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const key = `${l.tauxTVA}`;
      tvaMap[key] = (tvaMap[key] || 0) + (l.totalHT * l.tauxTVA / 100);
    }
  });

  const totRows: { label: string; value: string; large?: boolean }[] = [
    { label: 'TOTAL HT :', value: `${fmt(facture.montantHT)} €` },
  ];
  if (Object.keys(tvaMap).length > 0) {
    Object.entries(tvaMap).forEach(([taux, montant]) =>
      totRows.push({ label: `TVA (${taux}%) :`, value: `${fmt(montant)} €` })
    );
  } else {
    totRows.push({ label: 'TVA :', value: `${fmt(facture.montantTTC - facture.montantHT)} €` });
  }

  const totEndY = drawTotaux(doc, y, totRows);
  y = Math.max(y + 14, totEndY) + 6;

  // ─── SIGNATURE (gauche) + NET À PAYER + petit encart ACOMPTE (droite) ─
  const montantAffiche = isAcompte
    ? Math.round(facture.montantTTC * 0.30 * 100) / 100
    : facture.resteAPayer > 0 && !facture.paye ? facture.resteAPayer : facture.montantTTC;

  const labelAffiche = isAcompte ? 'ACOMPTE À PAYER'
    : facture.paye ? 'TOTAL TTC'
    : facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC ? 'RESTE À PAYER'
    : 'NET À PAYER';

  // Petit encart acompte uniquement si paiements partiels (déjà réglé)
  let acoLabel: string | undefined;
  let acoValue: string | undefined;
  if (!facture.paye && facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC && !isAcompte) {
    acoLabel = 'DÉJÀ RÉGLÉ';
    acoValue = `${fmt(facture.montantTTC - facture.resteAPayer)} €`;
  }

  y = drawSignatureAndNet(
    doc, y,
    labelAffiche, `${fmt(montantAffiche)} €`,
    acoLabel, acoValue
  ) + 8;

  // ─── RIB ──────────────────────────────────────────────────────
  if (TPL_SHOW_RIB) {
    y = drawRib(doc, y) + 2;
  }

  // ─── FOOTER ───────────────────────────────────────────────────
  drawFooter(doc);

  return doc;
}

// ─── API publique (async) ─────────────────────────────────────

export async function openFacturePdf(params: FacturePdfParams): Promise<void> {
  const doc = await buildFacturePdf(params);
  window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

export async function facturePdfToBlobUrl(params: FacturePdfParams): Promise<string> {
  const doc = await buildFacturePdf(params);
  return URL.createObjectURL(doc.output('blob'));
}

export async function downloadFacturePdf(params: FacturePdfParams): Promise<void> {
  const doc = await buildFacturePdf(params);
  doc.save(`${params.facture.ref}.pdf`);
}

export async function facturePdfToBase64(params: FacturePdfParams): Promise<string> {
  const doc = await buildFacturePdf(params);
  return doc.output('datauristring').split(',')[1];
}
