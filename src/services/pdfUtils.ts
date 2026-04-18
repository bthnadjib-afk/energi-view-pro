/**
 * Utilitaires partagés pour la génération de PDF — ELECTRICIEN DU GENEVOIS
 * Police : Helvetica (intégrée jsPDF) — visuellement identique à Roboto en PDF viewer
 */
import jsPDF from 'jspdf';
import logoUrl from '@/assets/logo.png';

// ─── Lecture de la config template depuis localStorage ────────
type TemplateCfg = {
  logoUrl?: string;
  couleurPrimaire?: string;
  couleurAccent?: string;
  couleurTexte?: string;
  police?: 'helvetica' | 'times' | 'courier' | 'roboto';
  margeHaut?: number;
  margeBas?: number;
  margeGauche?: number;
  margeDroite?: number;
  tailleTitre?: number;
  tailleTexte?: number;
  piedDePage?: string;
  afficherRib?: boolean;
  afficherCgv?: boolean;
};

function getTemplateCfg(): TemplateCfg {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('electropro-config');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed?.template as TemplateCfg) || {};
  } catch { return {}; }
}

function hexToRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return fallback;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// ─── Palette EDG (valeurs de fallback, surchargées par template) ────
const _T = getTemplateCfg();
export const NOIR:       [number,number,number] = hexToRgb(_T.couleurPrimaire, [26, 26, 26]);
export const BLANC:      [number,number,number] = [255,255,255];
export const GRIS_CLAIR: [number,number,number] = [247,247,247];
export const GRIS_LIGNE: [number,number,number] = [224,224,224];
export const GRIS_TEXTE: [number,number,number] = [85, 85, 85];
export const GRIS_SOMBRE:[number,number,number] = [68, 68, 68];
export const GRIS_PIED:  [number,number,number] = [120,120,120];
export const ROUGE:      [number,number,number] = hexToRgb(_T.couleurAccent, [204,  0,  0]);
export const ROUGE_BG:   [number,number,number] = [255,248,248];

// ─── Mise en page A4 (margeXxx surchargées par template) ────
export const ML     = _T.margeGauche ?? 15;
export const MR     = _T.margeDroite ?? 15;
export const MT     = _T.margeHaut   ?? 18;
export const PAGE_W = 210;
export const PAGE_H = 297;
export const COL_R  = PAGE_W - MR;
export const CW     = PAGE_W - ML - MR;

// Police globale (helvetica/times/courier/roboto)
export const TPL_FONT: 'helvetica' | 'times' | 'courier' | 'roboto' = (_T.police || 'roboto') as any;
export const TPL_LOGO_URL: string = _T.logoUrl || '';
export const TPL_FOOTER_TEXT: string = _T.piedDePage || '';
export const TPL_SHOW_RIB: boolean = _T.afficherRib !== false;
export const TPL_SHOW_CGV: boolean = _T.afficherCgv !== false;

// ─── Helpers ──────────────────────────────────────────────────
export function fmt(n: number | null | undefined): string {
  const num = typeof n === 'number' && isFinite(n) ? n : 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toText(v: unknown): string {
  return v == null ? '' : String(v);
}

export function formatDateFR(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Chargement logo ──────────────────────────────────────────
async function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Police Roboto (chargée depuis jsdelivr CDN, mise en cache) ──────
let _robotoLoaded = false;
const ROBOTO_URLS: Record<string, string> = {
  normal:     'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Regular.ttf',
  bold:       'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Bold.ttf',
  italic:     'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Italic.ttf',
  bolditalic: 'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-BoldItalic.ttf',
};

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function loadRobotoFonts(doc: jsPDF): Promise<void> {
  if (TPL_FONT !== 'roboto') return;
  try {
    const styles: Array<['normal'|'bold'|'italic'|'bolditalic', string]> = [
      ['normal', ROBOTO_URLS.normal],
      ['bold', ROBOTO_URLS.bold],
      ['italic', ROBOTO_URLS.italic],
      ['bolditalic', ROBOTO_URLS.bolditalic],
    ];
    for (const [style, url] of styles) {
      const b64 = await fetchAsBase64(url);
      const filename = `Roboto-${style}.ttf`;
      doc.addFileToVFS(filename, b64);
      doc.addFont(filename, 'roboto', style === 'bolditalic' ? 'bold' : style, style === 'bolditalic' ? 'italic' : 'normal');
    }
    _robotoLoaded = true;
  } catch (e) {
    console.warn('Roboto load failed, fallback helvetica', e);
  }
}

export function setFont(doc: jsPDF, style: 'normal'|'bold'|'italic'|'bolditalic') {
  try {
    if (TPL_FONT === 'roboto') {
      // jsPDF API: setFont(family, fontStyle, fontWeight)
      const map: Record<string, [string, string]> = {
        normal:     ['normal', 'normal'],
        bold:       ['bold',   'normal'],
        italic:     ['italic', 'normal'],
        bolditalic: ['italic', 'bold'],
      };
      const [fontStyle, weight] = map[style];
      doc.setFont('roboto', fontStyle, weight);
      return;
    }
    doc.setFont(TPL_FONT, style);
  } catch {
    doc.setFont('helvetica', style);
  }
}

// ─── Dessin du logo (logo personnalisé via TPL_LOGO_URL en priorité) ─
export async function drawLogo(doc: jsPDF, x: number, y: number): Promise<number> {
  const src = TPL_LOGO_URL || logoUrl;
  try {
    const img = await loadImageEl(src);
    const logoW = 72; // agrandi (avant 52)
    // Conserve le ratio naturel de l'image pour éviter toute déformation
    const naturalRatio =
      img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1 / 3.5;
    const logoH = Math.round(logoW * naturalRatio);
    doc.addImage(img, 'PNG', x, y, logoW, logoH);
    return logoH;
  } catch {
    return 0;
  }
}

// ─── Barre d'info (ref / date / validité) ────────────────────
export function drawInfoBar(
  doc: jsPDF,
  y: number,
  cells: { label: string; value: string }[]
): number {
  const barH = 8;
  doc.setFillColor(...NOIR);
  doc.rect(ML, y, CW, barH, 'F');
  const cellW = CW / cells.length;
  cells.forEach((c, i) => {
    const cx = ML + i * cellW + cellW / 2;
    setFont(doc, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(c.label.toUpperCase(), cx, y + 2.8, { align: 'center' });
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BLANC);
    doc.text(c.value, cx, y + 6.5, { align: 'center' });
  });
  return barH;
}

// ─── En-tête client / entreprise (deux colonnes) ─────────────
export interface EntrepriseInfo {
  nom?: string; adresse?: string; codePostal?: string; ville?: string;
  siret?: string; telephone?: string; email?: string;
}
export interface ClientInfo {
  nom?: string; adresse?: string; codePostal?: string; ville?: string;
  email?: string; telephone?: string;
}

export function drawParties(
  doc: jsPDF,
  y: number,
  client: ClientInfo,
  entreprise?: EntrepriseInfo
): number {
  const startY = y;

  // ─── CLIENT (gauche, aligné à gauche) ─────────────────────────
  setFont(doc, 'bolditalic');
  doc.setFontSize(9.5);
  doc.setTextColor(...NOIR);
  doc.text(toText(client.nom || ''), ML, y);
  y += 5.5;

  setFont(doc, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(34, 34, 34);
  const clientLines: string[] = [];
  if (client.adresse)   clientLines.push(toText(client.adresse));
  const city = [client.codePostal, client.ville].filter(Boolean).map(toText).join(' ');
  if (city)             clientLines.push(city);
  if (client.email)     clientLines.push(toText(client.email));
  if (client.telephone) clientLines.push(toText(client.telephone));
  clientLines.forEach(l => { doc.text(l, ML, y); y += 4.8; });

  // ─── ENTREPRISE (droite, aligné à droite sur COL_R) ───────────
  const ent = entreprise;
  let ey = startY;
  setFont(doc, 'bolditalic');
  doc.setFontSize(9.5);
  doc.setTextColor(...NOIR);
  doc.text(toText(ent?.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase(), COL_R, ey, { align: 'right' });
  ey += 5.5;

  setFont(doc, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(34, 34, 34);
  const entLines = [
    'AU CAPITAL DE 1 000 €',
    [ent?.adresse || '99 ROUTE DU CHATELET', ent?.codePostal || '74800', ent?.ville || 'CORNIER'].filter(Boolean).join(' '),
    `SIRET : ${ent?.siret || '940 874 936 00013'} — RCS ANNECY`,
    (ent?.email || 'CONTACT@ELECTRICIENDUGENEVOIS.FR').toUpperCase(),
    ent?.telephone || '06 02 04 42 02',
  ];
  entLines.forEach(l => { doc.text(l, COL_R, ey, { align: 'right' }); ey += 4.8; });

  return Math.max(y, ey);
}

// ─── Totaux (alignés à droite) ────────────────────────────────
export function drawTotaux(
  doc: jsPDF,
  y: number,
  rows: { label: string; value: string; large?: boolean }[]
): number {
  const totW = 72;
  const totX = COL_R - totW;
  rows.forEach(r => {
    setFont(doc, 'italic');
    doc.setFontSize(r.large ? 11 : 8.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(r.label, totX, y);
    setFont(doc, 'bolditalic');
    doc.setFontSize(r.large ? 12 : 9);
    doc.setTextColor(...NOIR);
    doc.text(r.value, COL_R, y, { align: 'right' });
    y += r.large ? 8 : 5.5;
  });
  return y;
}

// ─── Signature (gauche) + NET À PAYER + petit encart ACOMPTE (droite) ──
// L'encart acompte fait la MÊME LARGEUR que la box NET et est juste en dessous.
export function drawSignatureAndNet(
  doc: jsPDF,
  y: number,
  netLabel: string,
  netValue: string,
  acompteLabel?: string,
  acompteValue?: string
): number {
  const rightW = Math.round(CW * 0.45);     // largeur bloc droit (TTC + acompte)
  const rightX = COL_R - rightW;
  const sigW   = rightX - ML - 5;           // signature à gauche, gap 5mm
  const netH   = 16;                        // hauteur box NET
  const acoH   = acompteLabel ? 12 : 0;     // hauteur petit encart acompte
  const totalH = netH + (acoH ? acoH + 2 : 0); // 2mm de gap entre les 2 boxes
  const sigH   = Math.max(totalH, 30);

  // ─ Box signature (gauche) ─
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.5);
  doc.rect(ML, y, sigW, sigH, 'S');
  setFont(doc, 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_SOMBRE);
  doc.text("Signature précédée de la mention « bon pour accord » :", ML + 3, y + 6);

  // ─ Box NET À PAYER (droite, haut) ─
  doc.setFillColor(...NOIR);
  doc.rect(rightX, y, rightW, netH, 'F');
  setFont(doc, 'bolditalic');
  doc.setFontSize(11);
  doc.setTextColor(...BLANC);
  doc.text(`${netLabel} : ${netValue}`, rightX + rightW / 2, y + netH / 2 + 1.5, { align: 'center' });

  // ─ Petit encart ACOMPTE (droite, juste en dessous, même largeur) ─
  if (acompteLabel && acompteValue) {
    const acoY = y + netH + 2;
    doc.setFillColor(...ROUGE_BG);
    doc.setDrawColor(...ROUGE);
    doc.setLineWidth(1.2);
    doc.roundedRect(rightX, acoY, rightW, acoH, 1.2, 1.2, 'FD');
    setFont(doc, 'bolditalic');
    doc.setFontSize(7);
    doc.setTextColor(...ROUGE);
    doc.text(acompteLabel, rightX + rightW / 2, acoY + 4.5, { align: 'center' });
    doc.setFontSize(9);
    doc.text(acompteValue, rightX + rightW / 2, acoY + 9, { align: 'center' });
  }

  return y + sigH;
}

// ─── RIB ──────────────────────────────────────────────────────
export function drawRib(doc: jsPDF, y: number): number {
  setFont(doc, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NOIR);
  doc.text('Moyens de paiement :', ML, y);
  y += 5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  doc.text('IBAN : FR76 1695 8000 0179 9683 5713 173', ML, y);
  y += 4.5;
  doc.text('BIC  : QNTOFRP1XXX', ML, y);
  return y + 4;
}

// ─── Footer légal (en bas de page) — surchargeable via TPL_FOOTER_TEXT ─
export function drawFooter(doc: jsPDF): void {
  const footY = PAGE_H - 20;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(ML, footY, COL_R, footY);

  // Si l'utilisateur a défini un pied-de-page custom, on l'utilise à la place
  if (TPL_FOOTER_TEXT && TPL_FOOTER_TEXT.trim().length > 0) {
    setFont(doc, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS_PIED);
    const wrapped = doc.splitTextToSize(TPL_FOOTER_TEXT, CW);
    doc.text(wrapped, PAGE_W / 2, footY + 4, { align: 'center' });
    return;
  }

  const legal = [
    { text: "Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO — Contrat n° 24015161184.", bold: true },
    { text: "Les matériaux et équipements restent la propriété de l'entreprise jusqu'au paiement intégral de la facture (art. 2367 du Code civil).", bold: false },
    { text: "Tout retard de paiement entraînera des pénalités de 10 % par an et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).", bold: false },
  ];
  let fy = footY + 4;
  legal.forEach(l => {
    setFont(doc, l.bold ? 'bold' : 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...(l.bold ? GRIS_SOMBRE : GRIS_PIED));
    const wrapped = doc.splitTextToSize(l.text, CW);
    doc.text(wrapped, PAGE_W / 2, fy, { align: 'center' });
    fy += wrapped.length * 3.3;
  });
}

// ─── CGV (page entière) ───────────────────────────────────────
export function drawCGV(doc: jsPDF): void {
  doc.addPage();
  let y = MT;

  // Titre
  setFont(doc, 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(...NOIR);
  doc.text('CONDITIONS GÉNÉRALES DE VENTE', PAGE_W / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...NOIR);
  doc.setLineWidth(0.5);
  doc.line(ML, y, COL_R, y);
  y += 8;

  const articles: { titre: string; texte: string }[] = [
    {
      titre: '1. Objet et acceptation',
      texte: "Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les prestations et fournitures réalisées par EURL ELECTRICIEN DU GENEVOIS. Toute commande implique l'acceptation sans réserve de ces CGV.",
    },
    {
      titre: '2. Devis et commande',
      texte: "Nos devis sont valables 30 jours à compter de leur émission. La commande est ferme dès la réception du devis signé avec la mention « bon pour accord » et le versement de l'acompte.",
    },
    {
      titre: '3. Prix et facturation',
      texte: "Les prix sont établis en euros hors taxes. Tout travail supplémentaire non prévu au devis initial fera l'objet d'un avenant écrit signé des deux parties.",
    },
    {
      titre: '4. Modalités de paiement',
      texte: "Un acompte de 30 % est exigible à la signature du devis (50 % pour les chantiers inférieurs à 5 000 € HT). Le solde est dû à la réception des travaux. Paiement par virement bancaire, chèque ou espèces. En cas de retard, des pénalités de 10 % par an seront appliquées, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).",
    },
    {
      titre: '5. Délais d\'exécution',
      texte: "Les délais d'exécution sont donnés à titre indicatif et courent à compter de la réception de l'acompte. L'Entreprise ne saurait être tenue responsable des retards résultant de causes extérieures (intempéries, retards d'approvisionnement, cas de force majeure).",
    },
    {
      titre: '6. Réserve de propriété',
      texte: "Les fournitures et équipements installés restent la propriété de l'Entreprise jusqu'au paiement intégral de la facture, conformément à l'article 2367 du Code civil.",
    },
    {
      titre: '7. Garantie',
      texte: "L'Entreprise garantit ses travaux pendant un an à compter de la réception. Cette garantie couvre les défauts de pose et de mise en œuvre, à l'exclusion de toute usure normale, mauvaise utilisation ou intervention d'un tiers non mandaté.",
    },
    {
      titre: '8. Assurance',
      texte: "L'Entreprise est assurée en responsabilité civile professionnelle et en garantie décennale auprès de la compagnie ERGO — Contrat n° 24015161184. Les attestations d'assurance sont disponibles sur demande.",
    },
    {
      titre: '9. Résiliation',
      texte: "En cas d'annulation du chantier par le client après signature du devis, l'acompte versé restera acquis à l'Entreprise à titre d'indemnité forfaitaire. Si des travaux ont déjà été engagés, leur valeur sera facturée.",
    },
    {
      titre: '10. Litiges',
      texte: "En cas de différend, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord, le Tribunal compétent du ressort du siège social de l'Entreprise (Annecy) sera seul compétent.",
    },
  ];

  articles.forEach(a => {
    // Titre article
    setFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NOIR);
    doc.text(a.titre, ML, y);
    y += 5;

    // Texte article
    setFont(doc, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_SOMBRE);
    const lines = doc.splitTextToSize(a.texte, CW);
    doc.text(lines, ML, y);
    y += lines.length * 4 + 4;

    // Séparateur léger
    doc.setDrawColor(...GRIS_LIGNE);
    doc.setLineWidth(0.2);
    doc.line(ML, y - 1, COL_R, y - 1);

    // Saut de page si nécessaire
    if (y > PAGE_H - 30) {
      doc.addPage();
      y = MT;
    }
  });

  drawFooter(doc);
}
