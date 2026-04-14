// Local PDF generator for Bon d'Intervention — téléchargement direct, pas de popup
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Intervention, Client, InterventionLine } from '@/services/dolibarr';

interface PdfParams {
  intervention: Intervention;
  client?: Client;
  lines: InterventionLine[];
  signatureClient?: string;
  signatureTech?: string;
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

function formatDateFR(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

const TYPE_LABELS: Record<string, string> = {
  devis: 'Devis', panne: 'Panne', panne_urgence: 'Panne urgence', sav: 'SAV', chantier: 'Chantier',
};

/** Internal: builds the jsPDF doc object */
function buildInterventionPdf({ intervention, client, lines, entreprise, signatureClient, signatureTech }: PdfParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // ─── HEADER: Entreprise (gauche) ───
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(entreprise?.nom || "Bon d'Intervention", margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  y += 7;
  if (entreprise?.adresse) { doc.text(entreprise.adresse, margin, y); y += 4.5; }
  if (entreprise?.codePostal || entreprise?.ville) {
    doc.text(`${entreprise?.codePostal || ''} ${entreprise?.ville || ''}`.trim(), margin, y); y += 4.5;
  }
  if (entreprise?.telephone) { doc.text(`Tél : ${entreprise.telephone}`, margin, y); y += 4.5; }
  if (entreprise?.email) { doc.text(entreprise.email, margin, y); y += 4.5; }
  if (entreprise?.siret) { doc.text(`SIRET : ${entreprise.siret}`, margin, y); y += 4.5; }

  // ─── REF BOX (droite, style Soleil) ───
  const refBoxX = pageWidth - margin - 72;
  const refBoxY = 12;
  // Bordure fine grise + fond bleu clair
  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(refBoxX, refBoxY, 72, 30, 2, 2, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`BON D'INTERVENTION`, refBoxX + 36, refBoxY + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.text(intervention.ref || '', refBoxX + 36, refBoxY + 17, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Date : ${formatDateFR(intervention.date)}`, refBoxX + 36, refBoxY + 25, { align: 'center' });

  y = Math.max(y, refBoxY + 37);

  // ─── Séparateur ───
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── CLIENT (bloc avec bordure grise, style Soleil) ───
  const clientBlockH = client ? 32 : 14;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, y - 3, pageWidth - 2 * margin, clientBlockH, 2, 2, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('CLIENT', margin + 4, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  if (client) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(client.nom, margin + 30, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    let cy = y + 9;
    if (client.adresse) { doc.text(client.adresse, margin + 4, cy); cy += 4.5; }
    const cityLine = [client.codePostal, client.ville].filter(Boolean).join(' ');
    if (cityLine) { doc.text(cityLine, margin + 4, cy); cy += 4.5; }
    if (client.telephone) doc.text(`Tél : ${client.telephone}`, margin + 4, cy);
    if (client.email) doc.text(client.email, margin + 70, cy);
  } else {
    doc.text(intervention.client || 'N/A', margin + 30, y + 3);
  }
  y += clientBlockH + 5;

  // ─── DÉTAILS INTERVENTION ───
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('DÉTAILS DE L\'INTERVENTION', margin, y);
  y += 2;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 55, y);
  y += 5;

  const details: [string, string][] = [
    ['Type', TYPE_LABELS[intervention.type] || intervention.type || 'N/A'],
    ['Date', formatDateFR(intervention.date)],
    ['Horaires', `${intervention.heureDebut || '--:--'} → ${intervention.heureFin || '--:--'}`],
    ['Technicien', intervention.technicien || 'N/A'],
  ];

  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(`${label} :`, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(value, margin + 35, y);
    y += 5;
  });

  // Description
  if (intervention.description) {
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Description :', margin + 4, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const descLines = doc.splitTextToSize(intervention.description, pageWidth - 2 * margin - 8);
    doc.text(descLines, margin + 4, y);
    y += descLines.length * 4.5;
  }

  y += 6;

  // ─── TABLEAU DES LIGNES (style Soleil: bordures grises, total en bas) ───
  if (lines && lines.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('LIGNES D\'INTERVENTION', margin, y);
    y += 2;
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 50, y);
    y += 4;

    const totalDuration = lines.reduce((sum, l) => sum + (l.duree || 0), 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Description', 'Date', 'Durée']],
      body: lines.map((line, i) => [
        String(i + 1),
        line.description || '',
        formatDateFR(line.date),
        formatDuration(line.duree || 0),
      ]),
      foot: totalDuration > 0 ? [['', 'TOTAL HEURES', '', formatDuration(totalDuration)]] : undefined,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [40, 40, 40],
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        lineColor: [30, 64, 175],
      },
      footStyles: {
        fillColor: [239, 246, 255],
        textColor: [30, 64, 175],
        fontStyle: 'bold',
        lineColor: [200, 200, 200],
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
      },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 20;
  }

  // ─── SIGNATURES ───
  if (signatureClient || signatureTech) {
    y += 8;
    // Check if we need a new page
    if (y > pageH - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('SIGNATURES', margin, y);
    y += 2;
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 30, y);
    y += 6;

    const sigWidth = 60;
    const sigHeight = 30;

    if (signatureTech) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Technicien :', margin, y);
      y += 3;
      try { doc.addImage(signatureTech, 'PNG', margin, y, sigWidth, sigHeight); } catch {}
      y += sigHeight + 4;
    }

    if (signatureClient) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Client :', margin, y);
      y += 3;
      try { doc.addImage(signatureClient, 'PNG', margin, y, sigWidth, sigHeight); } catch {}
      y += sigHeight + 4;
    }
  }

  // ─── FOOTER ───
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 20, pageWidth - margin, pageH - 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${entreprise?.nom || 'Entreprise'} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth / 2, pageH - 14, { align: 'center' }
  );

  return doc;
}

/** Génère et télécharge directement le PDF — aucune popup bloquée */
export function generateInterventionPdfLocal(params: PdfParams): void {
  const doc = buildInterventionPdf(params);
  const fileName = `${params.intervention.ref || 'intervention'}.pdf`;
  doc.save(fileName);
}

/** Génère le PDF et retourne un blob URL pour ouverture dans un nouvel onglet */
export function generateInterventionPdfBlobUrl(params: PdfParams): string {
  const doc = buildInterventionPdf(params);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/** Génère le PDF et retourne le contenu en base64 (pour envoi email) */
export function generateInterventionPdfBase64(params: PdfParams): string {
  const doc = buildInterventionPdf(params);
  // doc.output('datauristring') returns "data:application/pdf;base64,XXXX"
  // We need just the base64 part
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}
