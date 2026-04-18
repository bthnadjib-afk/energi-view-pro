/**
 * Utilitaires partagés pour la génération de PDF — ELECTRICIEN DU GENEVOIS
 * La config template est relue depuis localStorage à CHAQUE génération
 * pour refléter immédiatement les changements de préférences.
 */
import jsPDF from 'jspdf';
import logoUrl from '@/assets/logo.png';

// ─── Type config template ─────────────────────────────────────
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

function readTemplateCfg(): TemplateCfg {
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

// ─── Config dynamique (relue à chaque appel) ──────────────────
export interface PdfConfig {
  NOIR:       [number,number,number];
  BLANC:      [number,number,number];
  GRIS_CLAIR: [number,number,number];
  GRIS_LIGNE: [number,number,number];
  GRIS_TEXTE: [number,number,number];
  GRIS_SOMBRE:[number,number,number];
  GRIS_PIED:  [number,number,number];
  ROUGE:      [number,number,number];
  ROUGE_BG:   [number,number,number];
  ML: number; MR: number; MT: number;
  PAGE_W: number; PAGE_H: number;
  COL_R: number; CW: number;
  TPL_FONT: 'helvetica' | 'times' | 'courier';
  TPL_LOGO_URL: string;
  TPL_FOOTER_TEXT: string;
  TPL_SHOW_RIB: boolean;
  TPL_SHOW_CGV: boolean;
}

export function getPdfConfig(): PdfConfig {
  const T = readTemplateCfg();
  const ML = T.margeGauche ?? 15;
  const MR = T.margeDroite ?? 15;
  const MT = T.margeHaut   ?? 18;
  const PAGE_W = 210;
  const PAGE_H = 297;
  return {
    NOIR:        hexToRgb(T.couleurPrimaire, [26, 26, 26]),
    BLANC:       [255, 255, 255],
    GRIS_CLAIR:  [247, 247, 247],
    GRIS_LIGNE:  [224, 224, 224],
    GRIS_TEXTE:  [85,  85,  85],
    GRIS_SOMBRE: [68,  68,  68],
    GRIS_PIED:   [120, 120, 120],
    ROUGE:       hexToRgb(T.couleurAccent, [204, 0, 0]),
    ROUGE_BG:    [255, 248, 248],
    ML, MR, MT, PAGE_W, PAGE_H,
    COL_R: PAGE_W - MR,
    CW:    PAGE_W - ML - MR,
    TPL_FONT:        (T.police === 'times' || T.police === 'courier' ? T.police : 'helvetica') as PdfConfig['TPL_FONT'],
    TPL_LOGO_URL:    T.logoUrl    || '',
    TPL_FOOTER_TEXT: T.piedDePage || '',
    TPL_SHOW_RIB:    T.afficherRib !== false,
    TPL_SHOW_CGV:    T.afficherCgv !== false,
  };
}

// ─── Exports de compatibilité (lus dynamiquement) ─────────────
// Ces valeurs sont recalculées à chaque import initial mais les
// fonctions drawXxx lisent getPdfConfig() dynamiquement.
const _INIT = getPdfConfig();
export const NOIR        = _INIT.NOIR;
export const BLANC       = _INIT.BLANC;
export const GRIS_CLAIR  = _INIT.GRIS_CLAIR;
export const GRIS_LIGNE  = _INIT.GRIS_LIGNE;
export const GRIS_TEXTE  = _INIT.GRIS_TEXTE;
export const GRIS_SOMBRE = _INIT.GRIS_SOMBRE;
export const GRIS_PIED   = _INIT.GRIS_PIED;
export const ROUGE       = _INIT.ROUGE;
export const ROUGE_BG    = _INIT.ROUGE_BG;
export const ML          = _INIT.ML;
export const MR          = _INIT.MR;
export const MT          = _INIT.MT;
export const PAGE_W      = _INIT.PAGE_W;
export const PAGE_H      = _INIT.PAGE_H;
export const COL_R       = _INIT.COL_R;
export const CW          = _INIT.CW;
export const TPL_FONT        = _INIT.TPL_FONT;
export const TPL_LOGO_URL    = _INIT.TPL_LOGO_URL;
export const TPL_FOOTER_TEXT = _INIT.TPL_FOOTER_TEXT;
export const TPL_SHOW_RIB    = _INIT.TPL_SHOW_RIB;
export const TPL_SHOW_CGV    = _INIT.TPL_SHOW_CGV;

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

// ─── Police : on utilise les polices natives jsPDF (helvetica/times/courier) ──
// Pas de fetch réseau, pas d'erreur de combinaison fontstyle/fontweight.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loadRobotoFonts(_doc: jsPDF, _cfg: PdfConfig): Promise<void> {
  // No-op : conservé pour compat API. Les polices natives sont toujours dispo.
  return;
}

export function setFont(doc: jsPDF, style: 'normal'|'bold'|'italic'|'bolditalic', cfg: PdfConfig) {
  const family = cfg.TPL_FONT; // 'helvetica' | 'times' | 'courier'
  try {
    doc.setFont(family, style);
  } catch {
    // Fallback ultime : helvetica + style simple
    const safe = style === 'bolditalic' ? 'bold' : style;
    doc.setFont('helvetica', safe);
  }
}

// ─── Dessin du logo ────────────────────────────────────────────
export async function drawLogo(doc: jsPDF, x: number, y: number, cfg: PdfConfig): Promise<number> {
  const src = cfg.TPL_LOGO_URL || logoUrl;
  try {
    const img = await loadImageEl(src);
    const logoW = 72;
    const naturalRatio =
      img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1 / 3.5;
    const logoH = Math.round(logoW * naturalRatio);
    doc.addImage(img, 'PNG', x, y, logoW, logoH);
    return logoH;
  } catch {
    return 0;
  }
}

// ─── Barre d'info ─────────────────────────────────────────────
export function drawInfoBar(
  doc: jsPDF,
  y: number,
  cells: { label: string; value: string }[],
  cfg: PdfConfig
): number {
  const { ML, CW, NOIR, GRIS_TEXTE, BLANC } = cfg;
  const barH = 8;
  doc.setFillColor(...NOIR);
  doc.rect(ML, y, CW, barH, 'F');
  const cellW = CW / cells.length;
  cells.forEach((c, i) => {
    const cx = ML + i * cellW + cellW / 2;
    setFont(doc, 'normal', cfg);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(c.label.toUpperCase(), cx, y + 2.8, { align: 'center' });
    setFont(doc, 'bold', cfg);
    doc.setFontSize(8.5);
    doc.setTextColor(...BLANC);
    doc.text(c.value, cx, y + 6.5, { align: 'center' });
  });
  return barH;
}

// ─── En-tête client / entreprise ─────────────────────────────
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
  entreprise: EntrepriseInfo | undefined,
  cfg: PdfConfig
): number {
  const { ML, COL_R, NOIR } = cfg;
  const startY = y;

  setFont(doc, 'bolditalic', cfg);
  doc.setFontSize(9.5);
  doc.setTextColor(...NOIR);
  doc.text(toText(client.nom || ''), ML, y);
  y += 5.5;

  setFont(doc, 'normal', cfg);
  doc.setFontSize(8.5);
  doc.setTextColor(34, 34, 34);
  const clientLines: string[] = [];
  if (client.adresse)   clientLines.push(toText(client.adresse));
  const city = [client.codePostal, client.ville].filter(Boolean).map(toText).join(' ');
  if (city)             clientLines.push(city);
  if (client.email)     clientLines.push(toText(client.email));
  if (client.telephone) clientLines.push(toText(client.telephone));
  clientLines.forEach(l => { doc.text(l, ML, y); y += 4.8; });

  const ent = entreprise;
  let ey = startY;
  setFont(doc, 'bolditalic', cfg);
  doc.setFontSize(9.5);
  doc.setTextColor(...NOIR);
  doc.text(toText(ent?.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase(), COL_R, ey, { align: 'right' });
  ey += 5.5;

  setFont(doc, 'normal', cfg);
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

// ─── Totaux ───────────────────────────────────────────────────
export function drawTotaux(
  doc: jsPDF,
  y: number,
  rows: { label: string; value: string; large?: boolean }[],
  cfg: PdfConfig
): number {
  const { COL_R, GRIS_TEXTE, NOIR } = cfg;
  const totW = 72;
  const totX = COL_R - totW;
  rows.forEach(r => {
    setFont(doc, 'italic', cfg);
    doc.setFontSize(r.large ? 11 : 8.5);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(r.label, totX, y);
    setFont(doc, 'bolditalic', cfg);
    doc.setFontSize(r.large ? 12 : 9);
    doc.setTextColor(...NOIR);
    doc.text(r.value, COL_R, y, { align: 'right' });
    y += r.large ? 8 : 5.5;
  });
  return y;
}

// ─── Signature + NET À PAYER ──────────────────────────────────
export function drawSignatureAndNet(
  doc: jsPDF,
  y: number,
  netLabel: string,
  netValue: string,
  cfg: PdfConfig,
  acompteLabel?: string,
  acompteValue?: string
): number {
  const { ML, COL_R, CW, NOIR, BLANC, ROUGE, ROUGE_BG, GRIS_LIGNE, GRIS_SOMBRE } = cfg;
  const rightW = Math.round(CW * 0.45);
  const rightX = COL_R - rightW;
  const sigW   = rightX - ML - 5;
  const netH   = 16;
  const acoH   = acompteLabel ? 12 : 0;
  const totalH = netH + (acoH ? acoH + 2 : 0);
  const sigH   = Math.max(totalH, 30);

  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.5);
  doc.rect(ML, y, sigW, sigH, 'S');
  setFont(doc, 'bolditalic', cfg);
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS_SOMBRE);
  doc.text("Signature précédée de la mention « bon pour accord » :", ML + 3, y + 6);

  doc.setFillColor(...NOIR);
  doc.rect(rightX, y, rightW, netH, 'F');
  setFont(doc, 'bolditalic', cfg);
  doc.setFontSize(11);
  doc.setTextColor(...BLANC);
  doc.text(`${netLabel} : ${netValue}`, rightX + rightW / 2, y + netH / 2 + 1.5, { align: 'center' });

  if (acompteLabel && acompteValue) {
    const acoY = y + netH + 2;
    doc.setFillColor(...ROUGE_BG);
    doc.setDrawColor(...ROUGE);
    doc.setLineWidth(1.2);
    doc.roundedRect(rightX, acoY, rightW, acoH, 1.2, 1.2, 'FD');
    setFont(doc, 'bolditalic', cfg);
    doc.setFontSize(7);
    doc.setTextColor(...ROUGE);
    doc.text(acompteLabel, rightX + rightW / 2, acoY + 4.5, { align: 'center' });
    doc.setFontSize(9);
    doc.text(acompteValue, rightX + rightW / 2, acoY + 9, { align: 'center' });
  }

  return y + sigH;
}

// ─── RIB ──────────────────────────────────────────────────────
export function drawRib(doc: jsPDF, y: number, cfg: PdfConfig): number {
  const { ML, NOIR } = cfg;
  setFont(doc, 'bold', cfg);
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

// ─── Footer légal ─────────────────────────────────────────────
export function drawFooter(doc: jsPDF, cfg: PdfConfig): void {
  const { ML, COL_R, PAGE_W, PAGE_H, GRIS_LIGNE, GRIS_PIED, GRIS_SOMBRE, CW } = cfg;
  const footY = PAGE_H - 20;
  doc.setDrawColor(...GRIS_LIGNE);
  doc.setLineWidth(0.4);
  doc.line(ML, footY, COL_R, footY);

  if (cfg.TPL_FOOTER_TEXT && cfg.TPL_FOOTER_TEXT.trim().length > 0) {
    setFont(doc, 'normal', cfg);
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS_PIED);
    const wrapped = doc.splitTextToSize(cfg.TPL_FOOTER_TEXT, CW);
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
    setFont(doc, l.bold ? 'bold' : 'normal', cfg);
    doc.setFontSize(6.5);
    doc.setTextColor(...(l.bold ? GRIS_SOMBRE : GRIS_PIED));
    const wrapped = doc.splitTextToSize(l.text, CW);
    doc.text(wrapped, PAGE_W / 2, fy, { align: 'center' });
    fy += wrapped.length * 3.3;
  });
}

// ─── CGV (page 2) ─────────────────────────────────────────────
export function drawCGV(doc: jsPDF, cfg: PdfConfig): void {
  const { ML, COL_R, PAGE_W, PAGE_H, MT, NOIR, GRIS_LIGNE, GRIS_SOMBRE, CW } = cfg;
  doc.addPage();
  let y = MT;

  setFont(doc, 'bolditalic', cfg);
  doc.setFontSize(14);
  doc.setTextColor(...NOIR);
  doc.text('CONDITIONS GÉNÉRALES DE VENTE', PAGE_W / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...NOIR);
  doc.setLineWidth(0.5);
  doc.line(ML, y, COL_R, y);
  y += 8;

  const articles = [
    { titre: '1. Objet et acceptation', texte: "Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les prestations et fournitures réalisées par EURL ELECTRICIEN DU GENEVOIS. Toute commande implique l'acceptation sans réserve de ces CGV." },
    { titre: '2. Devis et commande', texte: "Nos devis sont valables 30 jours à compter de leur émission. La commande est ferme dès la réception du devis signé avec la mention « bon pour accord » et le versement de l'acompte." },
    { titre: '3. Prix et facturation', texte: "Les prix sont établis en euros hors taxes. Tout travail supplémentaire non prévu au devis initial fera l'objet d'un avenant écrit signé des deux parties." },
    { titre: '4. Modalités de paiement', texte: "Un acompte de 30 % est exigible à la signature du devis (50 % pour les chantiers inférieurs à 5 000 € HT). Le solde est dû à la réception des travaux. En cas de retard, des pénalités de 10 % par an seront appliquées, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce)." },
    { titre: "5. Délais d'exécution", texte: "Les délais d'exécution sont donnés à titre indicatif et courent à compter de la réception de l'acompte. L'Entreprise ne saurait être tenue responsable des retards résultant de causes extérieures (intempéries, retards d'approvisionnement, cas de force majeure)." },
    { titre: '6. Réserve de propriété', texte: "Les fournitures et équipements installés restent la propriété de l'Entreprise jusqu'au paiement intégral de la facture, conformément à l'article 2367 du Code civil." },
    { titre: '7. Garantie', texte: "L'Entreprise garantit ses travaux pendant un an à compter de la réception. Cette garantie couvre les défauts de pose et de mise en œuvre, à l'exclusion de toute usure normale, mauvaise utilisation ou intervention d'un tiers non mandaté." },
    { titre: '8. Assurance', texte: "L'Entreprise est assurée en responsabilité civile professionnelle et en garantie décennale auprès de la compagnie ERGO — Contrat n° 24015161184. Les attestations d'assurance sont disponibles sur demande." },
    { titre: '9. Résiliation', texte: "En cas d'annulation du chantier par le client après signature du devis, l'acompte versé restera acquis à l'Entreprise à titre d'indemnité forfaitaire. Si des travaux ont déjà été engagés, leur valeur sera facturée." },
    { titre: '10. Litiges', texte: "En cas de différend, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord, le Tribunal compétent du ressort du siège social de l'Entreprise (Annecy) sera seul compétent." },
  ];

  articles.forEach(a => {
    setFont(doc, 'bold', cfg);
    doc.setFontSize(8.5);
    doc.setTextColor(...NOIR);
    doc.text(a.titre, ML, y);
    y += 5;

    setFont(doc, 'normal', cfg);
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_SOMBRE);
    const lines = doc.splitTextToSize(a.texte, CW);
    doc.text(lines, ML, y);
    y += lines.length * 4 + 4;

    doc.setDrawColor(...GRIS_LIGNE);
    doc.setLineWidth(0.2);
    doc.line(ML, y - 1, COL_R, y - 1);

    if (y > PAGE_H - 30) { doc.addPage(); y = MT; }
  });

  drawFooter(doc, cfg);
}
