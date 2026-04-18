/**
 * Templates d'impression navigateur — pixel-perfect par rapport aux originaux EDG
 * Référence : EDG-FACTURE-ACCOMPTE-PCMG-V33 (converti via pdf2htmlEX)
 */
import type { Facture, DevisLigne, Client } from '@/services/dolibarr';
import logoUrl from '@/assets/logo.png';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  const num = typeof n === 'number' && isFinite(n) ? n : 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateFR(s: string | undefined | null): string {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function getLogoBase64(): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = logoUrl;
  });
}

// ─── Lignes tableau ───────────────────────────────────────────────────────────

function buildLignesHTML(lignes: DevisLigne[]): string {
  const mo  = lignes.filter(l => l.productType === 'main_oeuvre');
  const fo  = lignes.filter(l => l.productType === 'fourniture');
  const mix = lignes.filter(l => l.productType !== 'main_oeuvre' && l.productType !== 'fourniture');

  const row = (l: DevisLigne, even: boolean) => `
    <tr style="background:${even ? '#f9f9f9' : '#ffffff'}">
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:left;vertical-align:top;">${l.designation ?? ''}</td>
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:center;color:#666;white-space:nowrap;">${l.ref ?? ''}</td>
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:center;white-space:nowrap;">${l.quantite ?? ''}</td>
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:center;white-space:nowrap;">${l.unite || 'U'}</td>
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:right;white-space:nowrap;">${fmt(l.prixUnitaire)}&nbsp;€</td>
      <td style="padding:2.5mm 2mm;border-bottom:0.3pt solid #e0e0e0;text-align:right;font-weight:bold;white-space:nowrap;">${fmt(l.totalHT)}&nbsp;€</td>
    </tr>`;

  const sectionRow = (label: string) => `
    <tr>
      <td colspan="6" style="padding:3mm 2mm 1.5mm 0;font-weight:bold;font-style:italic;font-size:9pt;border-bottom:none;background:#fff;">${label}</td>
    </tr>`;

  let html = '';
  let rowIndex = 0;

  if (mo.length || fo.length) {
    if (mo.length) {
      html += sectionRow("Main d'œuvre");
      mo.forEach(l => { html += row(l, rowIndex % 2 === 1); rowIndex++; });
    }
    if (fo.length) {
      html += sectionRow('Fournitures');
      fo.forEach(l => { html += row(l, rowIndex % 2 === 1); rowIndex++; });
    }
  } else {
    mix.forEach(l => { html += row(l, rowIndex % 2 === 1); rowIndex++; });
  }

  return html;
}

// ─── CSS du template ──────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400;1,700&display=swap');

  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  @page {
    size: A4 portrait;
    margin: 18mm 14mm 20mm 14mm;
  }

  html, body {
    font-family: 'Roboto', Arial, sans-serif;
    font-size: 9pt;
    color: #1a1a1a;
    background: #fff;
  }

  .page {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* Logo */
  .logo { margin-bottom: 6mm; }
  .logo img { max-height: 22mm; max-width: 58mm; }

  /* Titre */
  .doc-titre {
    font-size: 20pt;
    font-weight: bold;
    font-style: italic;
    margin-bottom: 7mm;
    line-height: 1;
    color: #1a1a1a;
  }

  /* Deux colonnes client / entreprise */
  .parties {
    display: flex;
    width: 100%;
    margin-bottom: 7mm;
  }
  .party { width: 50%; }
  .party-name {
    font-weight: bold;
    font-style: italic;
    font-size: 9pt;
    margin-bottom: 2mm;
    color: #1a1a1a;
  }
  .party-info {
    font-size: 8.5pt;
    line-height: 1.65;
    color: #222;
  }

  /* Tableau */
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 0;
  }
  .tbl thead tr {
    border-top: 1.5pt solid #1a1a1a;
    border-bottom: 1.5pt solid #1a1a1a;
  }
  .tbl thead th {
    font-weight: bold;
    font-style: normal;
    padding: 2.5mm 2mm;
    background: transparent;
  }

  /* Séparateurs */
  .sep-thin { border:none; border-top:0.5pt solid #bbb; margin:4mm 0; }
  .sep-bold { border:none; border-top:1.5pt solid #1a1a1a; margin:0; }

  /* Zone date + totaux */
  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 3mm 0;
  }
  .date-note {
    font-size: 8pt;
    font-style: italic;
    color: #555;
    line-height: 1.8;
  }
  .totaux { text-align: right; line-height: 1.9; }
  .tot-line { display: flex; justify-content: flex-end; gap: 5mm; }
  .tot-line .lbl { font-style: italic; color: #555; font-size: 9pt; }
  .tot-line .val { font-weight: bold; font-style: italic; font-size: 9pt; min-width: 28mm; text-align: right; white-space: nowrap; }

  /* ACOMPTE À PAYER — même position que l'original : gauche + grand */
  .acompte-block { padding: 7mm 0 5mm; }
  .acompte-label {
    font-size: 22pt;
    font-weight: bold;
    font-style: italic;
    line-height: 1.2;
    color: #1a1a1a;
  }

  /* RIB */
  .rib { margin: 4mm 0; }
  .rib-titre { font-weight: bold; font-size: 9pt; margin-bottom: 1.5mm; }
  .rib-data { font-family: 'Courier New', monospace; font-size: 8pt; color: #333; line-height: 1.8; }

  /* Footer légal */
  .footer {
    margin-top: auto;
    padding-top: 3mm;
    border-top: 0.5pt solid #ccc;
    font-size: 7pt;
    font-style: italic;
    color: #666;
    text-align: center;
    line-height: 1.8;
  }

  /* Masquer tout sauf la page à l'impression */
  @media screen {
    body { background: #9e9e9e; }
    .page {
      background: #fff;
      width: 210mm;
      min-height: 297mm;
      margin: 10mm auto;
      padding: 18mm 14mm 20mm;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
  }
`;

// ─── Construction HTML facture ────────────────────────────────────────────────

export interface EntrepriseInfo {
  nom?: string; adresse?: string; codePostal?: string; ville?: string;
  siret?: string; telephone?: string; email?: string;
}

export interface FacturePrintParams {
  facture: Facture;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

function buildFactureHTML(
  facture: Facture,
  client: Client | undefined,
  ent: EntrepriseInfo | undefined,
  logo: string
): string {
  // Titre selon type Dolibarr (0=standard, 2=avoir, 3=acompte, 5=situation)
  const titre =
    facture.type === 3 ? "FACTURE D'ACOMPTE"
    : facture.type === 2 ? 'AVOIR'
    : facture.type === 5 ? 'FACTURE DE SITUATION'
    : 'FACTURE';

  const isAcompte = facture.type === 3;

  // Montant principal
  const montant = isAcompte
    ? Math.round(facture.montantTTC * 0.30 * 100) / 100
    : !facture.paye && facture.resteAPayer > 0
      ? facture.resteAPayer
      : facture.montantTTC;

  const labelMontant = isAcompte ? 'ACOMPTE À PAYER'
    : facture.paye ? 'TOTAL TTC — PAYÉE'
    : !facture.paye && facture.resteAPayer < facture.montantTTC ? 'RESTE À PAYER'
    : 'NET À PAYER';

  // TVA par taux
  const tvaMap: Record<string, number> = {};
  facture.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const k = `${l.tauxTVA}`;
      tvaMap[k] = (tvaMap[k] || 0) + l.totalHT * l.tauxTVA / 100;
    }
  });
  const tvaHTML = Object.keys(tvaMap).length
    ? Object.entries(tvaMap).map(([t, m]) => `
        <div class="tot-line">
          <span class="lbl">TVA&nbsp;${t}&nbsp;%</span>
          <span class="val">${fmt(m)}&nbsp;€</span>
        </div>`).join('')
    : `<div class="tot-line">
        <span class="lbl">TVA</span>
        <span class="val">${fmt(facture.montantTTC - facture.montantHT)}&nbsp;€</span>
       </div>`;

  // Infos client
  const clientNom = client?.nom || facture.client || '';
  const clientLines = [
    client?.adresse,
    client?.codePostal && client?.ville ? `${client.codePostal} ${client.ville}` : (client?.ville || ''),
    client?.email,
    client?.telephone,
  ].filter(Boolean).join('<br>');

  // Infos entreprise — même texte que l'original PCMG
  const entNom = (ent?.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase();
  const entLines = [
    `AU CAPITAL DE 1&nbsp;000&nbsp;€`,
    `${ent?.adresse || '99 ROUTE DU CHATELET'} ${ent?.codePostal || '74800'} ${ent?.ville || 'CORNIER'}`,
    `SIRET&nbsp;: ${ent?.siret || '940 874 936 00013'} – RCS ANNECY`,
    (ent?.email || 'CONTACT@ELECTRICIENDUGENEVOIS.FR').toUpperCase(),
    ent?.telephone || '06 02 04 42 02',
  ].join('<br>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${titre} — ${facture.ref}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="page">

  <!-- LOGO -->
  <div class="logo">
    ${logo ? `<img src="${logo}" alt="Logo Electricien du Genevois">` : ''}
  </div>

  <!-- TITRE (ex : FACTURE D'ACOMPTE) -->
  <div class="doc-titre">${titre}</div>

  <!-- CLIENT gauche / ENTREPRISE droite -->
  <div class="parties">
    <div class="party">
      <div class="party-name">${clientNom}</div>
      <div class="party-info">${clientLines}</div>
    </div>
    <div class="party">
      <div class="party-name">${entNom}</div>
      <div class="party-info">${entLines}</div>
    </div>
  </div>

  <!-- TABLEAU -->
  <table class="tbl">
    <thead>
      <tr>
        <th style="width:43%;text-align:left;">Description</th>
        <th style="width:9%;text-align:center;">Réf</th>
        <th style="width:7%;text-align:center;">Qté</th>
        <th style="width:7%;text-align:center;">Unité</th>
        <th style="width:17%;text-align:right;">Prix unitaire</th>
        <th style="width:17%;text-align:right;">Montant</th>
      </tr>
    </thead>
    <tbody>
      ${buildLignesHTML(facture.lignes)}
    </tbody>
  </table>

  <!-- SÉPARATEUR MINCE -->
  <hr class="sep-thin" style="margin-top:3mm;">

  <!-- DATE (gauche) + TOTAUX (droite) -->
  <div class="bottom-row">
    <div class="date-note">
      Date de la facture&nbsp;: ${dateFR(facture.date)}<br>
      ${isAcompte ? 'La présente facture correspond à un acompte de 30&nbsp;%.' : ''}
    </div>
    <div class="totaux">
      <div class="tot-line">
        <span class="lbl">TOTAL HT&nbsp;:</span>
        <span class="val">${fmt(facture.montantHT)}&nbsp;€</span>
      </div>
      ${tvaHTML}
    </div>
  </div>

  <!-- SÉPARATEUR ÉPAIS -->
  <hr class="sep-bold">

  <!-- ACOMPTE À PAYER (à gauche, grand — fidèle à l'original) -->
  <div class="acompte-block">
    <div class="acompte-label">${labelMontant}&nbsp;: ${fmt(montant)}&nbsp;€</div>
  </div>

  <!-- SÉPARATEUR -->
  <hr class="sep-thin">

  <!-- RIB -->
  <div class="rib">
    <div class="rib-titre">Moyens de paiement:</div>
    <div class="rib-data">
      IBAN : FR76 1695 8000 0179 9683 5713 173<br>
      BIC : QNTOFRP1XXX
    </div>
  </div>

  <!-- FOOTER LÉGAL -->
  <div class="footer">
    Tout retard de paiement entraînera des pénalités de 10% par an et une indemnité forfaitaire de 40&nbsp;€ pour frais de recouvrement (art. L441-10 du Code de commerce).<br>
    Nos travaux sont couverts par notre assurance décennale et Rc Pro auprès d'ERGO – Contrat n°&nbsp;24015161184.<br>
    Les matériaux et équipements restent la propriété de l'entreprise jusqu'au paiement intégral de la facture (art. 2367 du Code civil).
  </div>

</div>
</body>
</html>`;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/** Ouvre une fenêtre → l'utilisateur fait Ctrl+P / Enregistrer en PDF */
export async function printFacture(params: FacturePrintParams): Promise<void> {
  const logo = await getLogoBase64();
  const html  = buildFactureHTML(params.facture, params.client, params.entreprise, logo);

  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) {
    alert('Autorisez les popups pour générer le PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // Attendre que Google Fonts charge avant d'imprimer
  win.addEventListener('load', () => {
    setTimeout(() => { win.focus(); win.print(); }, 1000);
  });
}

/** Blob URL pour prévisualisation iframe */
export async function printFactureToBlobUrl(params: FacturePrintParams): Promise<string> {
  const logo = await getLogoBase64();
  const html  = buildFactureHTML(params.facture, params.client, params.entreprise, logo);
  const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}
