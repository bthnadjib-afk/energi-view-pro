// Local PDF generator for Bon d'Intervention — no Dolibarr builddoc needed
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Intervention, Client, InterventionLine } from '@/services/dolibarr';

interface PdfParams {
  intervention: Intervention;
  client?: Client;
  lines: InterventionLine[];
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

export function generateInterventionPdfLocal({ intervention, client, lines, entreprise }: PdfParams): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // === Header: Company info (left) + Intervention ref (right) ===
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // blue-800
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

  // Ref box (right side)
  const refBoxX = pageWidth - margin - 70;
  const refBoxY = 12;
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(refBoxX, refBoxY, 70, 28, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(`BON D'INTERVENTION`, refBoxX + 35, refBoxY + 8, { align: 'center' });
  doc.setFontSize(13);
  doc.text(intervention.ref || '', refBoxX + 35, refBoxY + 16, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Date : ${formatDateFR(intervention.date)}`, refBoxX + 35, refBoxY + 23, { align: 'center' });

  y = Math.max(y, refBoxY + 35);

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // === Client block ===
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(margin, y - 3, pageWidth - 2 * margin, client ? 30 : 14, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('CLIENT', margin + 4, y + 3);
  doc.setFont('helvetica', 'normal');
  if (client) {
    doc.setFontSize(11);
    doc.text(client.nom, margin + 30, y + 3);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    let cy = y + 9;
    if (client.adresse) { doc.text(client.adresse, margin + 4, cy); cy += 4.5; }
    const cityLine = [client.codePostal, client.ville].filter(Boolean).join(' ');
    if (cityLine) { doc.text(cityLine, margin + 4, cy); cy += 4.5; }
    if (client.telephone) doc.text(`Tél : ${client.telephone}`, margin + 4, cy);
    if (client.email) doc.text(client.email, margin + 60, cy);
  } else {
    doc.text(intervention.client || 'N/A', margin + 30, y + 3);
  }
  y += client ? 34 : 18;

  // === Intervention details ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('DÉTAILS DE L\'INTERVENTION', margin, y);
  y += 6;

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

  // === Lines table ===
  if (lines && lines.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('LIGNES D\'INTERVENTION', margin, y);
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
      foot: totalDuration > 0 ? [['', 'TOTAL', '', formatDuration(totalDuration)]] : undefined,
      styles: { fontSize: 9, cellPadding: 3, textColor: [40, 40, 40] },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
      },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 20;
  }

  // === Footer ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${entreprise?.nom || 'Entreprise'} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth / 2, footerY, { align: 'center' }
  );

  // Return blob URL
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
