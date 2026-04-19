/**
 * DocumentTemplate.tsx — Composant A4 unique pour Devis / Facture / Bon d'intervention.
 * Le MÊME composant alimente :
 *   - l'aperçu live du Template Playground (Préférences → Template)
 *   - la génération PDF (via html2canvas → jsPDF dans htmlToPdf.ts)
 * Garantit que ce que l'utilisateur voit = ce qu'il obtient en PDF, sur tous appareils.
 */
import type { CSSProperties } from 'react';

export type DocType = 'facture' | 'devis' | 'intervention';

export interface DocumentTemplateData {
  ref: string;
  date: string;             // ISO ou "dd/mm/yyyy"
  echeance?: string;        // facture
  validite?: string;        // devis
  type?: string;            // intervention : type label
  technicien?: string;      // intervention
  client: {
    nom: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    email?: string;
    telephone?: string;
  };
  lignes: Array<{
    designation: string;
    ref?: string;
    quantite: number;
    unite?: string;
    prixUnitaire: number;
    tauxTVA: number;
    totalHT: number;
  }>;
  totaux: {
    ht: number;
    tva: number;            // total TVA en €
    ttc: number;
    tvaParTaux?: Array<{ taux: number; montant: number }>;
  };
  paye?: boolean;
  resteAPayer?: number;
  description?: string;     // intervention
  observations?: string;    // intervention
  signatureClient?: string; // dataURL — intervention
  signatureTech?: string;   // dataURL — intervention
}

export interface DocumentTemplateCfg {
  logoUrl?: string;
  couleurPrimaire?: string;
  couleurAccent?: string;
  couleurTexte?: string;
  police?: 'helvetica' | 'times' | 'courier';
  margeHaut?: number;
  margeBas?: number;
  margeGauche?: number;
  margeDroite?: number;
  tailleTitre?: number;
  tailleTexte?: number;
  // Tailles fines optionnelles (pt) — fallback sur valeurs historiques si absentes
  tailleEntreprise?: number;
  tailleCoordonnees?: number;
  tailleRubanLabel?: number;
  tailleRubanValeur?: number;
  tailleTableauHeader?: number;
  tailleTableauLignes?: number;
  tailleTotaux?: number;
  tailleTotalTTC?: number;
  tailleEncartTexte?: number;
  taillePaiement?: number;
  taillePiedDePage?: number;
  logoHauteur?: number;
  logoLargeurMax?: number;
  largeurEncartTotaux?: number;
  largeurEncartBonAccord?: number;
  entrepriseEnFaceClient?: boolean;
  rubanCompact?: boolean;
  captureWidth?: number;
  piedDePage?: string;
  tauxAcompte?: number;
  seuilAcompte?: number;
  tauxAcompteSeuilDepasse?: number;
  afficherRib?: boolean;
  afficherCgv?: boolean;
  texteCgv?: string;
}

export interface EntrepriseInfo {
  nom?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  tvaIntra?: string;
  capitalSocial?: string;
  rcs?: string;
}

export interface DocumentTemplateProps {
  docType: DocType;
  data: DocumentTemplateData;
  template: DocumentTemplateCfg;
  entreprise?: EntrepriseInfo;
  /** Échelle d'affichage globale du document. Utiliser 1 pour le PDF. */
  scale?: number;
  /** Densité interne du contenu sans changer le format de page. */
  density?: number;
  /** Si true, le document peut grandir au-delà de l'A4 pour mesurer le besoin réel. */
  autoHeight?: boolean;
  /** Si true, n'affiche QUE la page CGV (utilisée comme dernière page du PDF). */
  cgvOnly?: boolean;
}

const PX_PER_MM = 96 / 25.4;
const A4_W_PX = 210 * PX_PER_MM;
const A4_H_PX = 297 * PX_PER_MM;

const fmt = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateFR = (d?: string) => {
  if (!d) return '';
  const date = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TITRES: Record<DocType, string> = {
  facture: 'FACTURE',
  devis: 'DEVIS',
  intervention: "BON D'INTERVENTION",
};

export function DocumentTemplate({
  docType,
  data,
  template: t,
  entreprise = {},
  scale = 1,
  density = 1,
  autoHeight = false,
  cgvOnly = false,
}: DocumentTemplateProps) {
  // Facteur global appliqué à TOUTES les tailles de texte / paddings dérivés.
  // 0.5 = tout est divisé par 2 par rapport à la version précédente.
  const TEXT_SCALE = 0.5;
  const unit = scale * PX_PER_MM * density * TEXT_SCALE;
  const W = A4_W_PX * scale;
  const H = A4_H_PX * scale;
  const mt = (t.margeHaut ?? 18) * unit;
  const mb = (t.margeBas ?? 20) * unit;
  const ml = (t.margeGauche ?? 15) * unit;
  const mr = (t.margeDroite ?? 15) * unit;
  const baseFontSize = (t.tailleTexte ?? 8.5) * unit * 1.2;
  const titleSize = (t.tailleTitre ?? 22) * unit;

  // ─── Tailles fines (chacune réglable indépendamment dans Préférences) ───
  // Si la valeur n'est pas définie, on retombe sur la valeur historique.
  const fsEntreprise   = (t.tailleEntreprise   ?? 11)   * unit;
  const fsCoord        = (t.tailleCoordonnees  ?? 9)    * unit;
  const fsRubanLabel   = (t.tailleRubanLabel   ?? 6.5)  * unit;
  const fsRubanValeur  = (t.tailleRubanValeur  ?? 8.5)  * unit;
  const fsTableHeader  = (t.tailleTableauHeader?? 8.5)  * unit;
  const fsTableLigne   = (t.tailleTableauLignes?? 8.5)  * unit;
  const fsTotaux       = (t.tailleTotaux       ?? 9.5)  * unit;
  const fsTotalTTC     = (t.tailleTotalTTC     ?? 11)   * unit;
  const fsEncartTexte  = (t.tailleEncartTexte  ?? 8.5)  * unit;
  const fsPaiement     = (t.taillePaiement     ?? 9)    * unit;
  const fsPiedDePage   = (t.taillePiedDePage   ?? 8)    * unit;
  // Logo (mm → px). Valeurs par défaut équivalentes à l'ancien hardcode (50px ≈ 13mm, 180px ≈ 48mm).
  const logoH = (t.logoHauteur ?? 13) * PX_PER_MM * scale * density;
  const logoMaxW = (t.logoLargeurMax ?? 48) * PX_PER_MM * scale * density;
  // Largeurs encarts (mm → px)
  const wEncTotaux = (t.largeurEncartTotaux ?? 80) * PX_PER_MM * scale * density;
  const wEncBonAccord = (t.largeurEncartBonAccord ?? 80) * PX_PER_MM * scale * density;
  const entrepriseEnFace = t.entrepriseEnFaceClient !== false;
  const rubanCompact = t.rubanCompact !== false;

  const primary = t.couleurPrimaire || '#1a1a1a';
  const accent = t.couleurAccent || '#cc0000';
  const textColor = t.couleurTexte || '#1a1a1a';
  const fontFamily =
    t.police === 'times'
      ? 'Times, "Times New Roman", serif'
      : t.police === 'courier'
      ? '"Courier New", Courier, monospace'
      : 'Helvetica, Arial, sans-serif';

  const pageStyle: CSSProperties = {
    width: W,
    minHeight: autoHeight ? undefined : H,
    maxHeight: autoHeight ? undefined : H,
    background: '#fff',
    color: textColor,
    fontFamily,
    fontSize: baseFontSize,
    paddingTop: mt,
    paddingBottom: mb,
    paddingLeft: ml,
    paddingRight: mr,
    boxSizing: 'border-box',
    lineHeight: density < 1 ? 1.24 : 1.4,
    overflow: autoHeight ? 'visible' : 'hidden',
  };

  // ─── Mode CGV uniquement (page finale dédiée) ─────────────────────
  // Les CGV doivent rester à leur taille NOMINALE pour conformité légale :
  // on neutralise TEXT_SCALE en divisant l'unit utilisée ici.
  if (cgvOnly) {
    return (
      <div style={pageStyle}>
        <div style={{ fontSize: 14 * unit, fontWeight: 700, fontStyle: 'italic', color: primary, marginBottom: 10 * unit, borderBottom: `0.75px solid ${primary}`, paddingBottom: 4 * unit }}>
          Conditions Générales de Vente
        </div>
        <div style={{ fontSize: 8 * unit, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.5, textAlign: 'justify' }}>
          {t.texteCgv || 'Aucune CGV configurée. Renseignez le texte dans Préférences → Template.'}
        </div>
      </div>
    );
  }

  const showEcheance = docType === 'facture';
  const showValidite = docType === 'devis';
  const showAcompte = docType === 'devis';
  const showSignatures = docType === 'intervention';
  // Pas de totaux sur le bon d'intervention (pas de prix)
  const showTableTotals = docType === 'devis' || docType === 'facture';
  const tauxAcompte = (t.seuilAcompte && t.seuilAcompte > 0 && data.totaux.ttc > t.seuilAcompte)
    ? (t.tauxAcompteSeuilDepasse ?? 50)
    : (t.tauxAcompte ?? 30);
  const acompte = data.totaux.ttc * (tauxAcompte / 100);

  // Bloc "infos entreprise" — nom + coordonnées en italique
  const blocEntreprise = (
    <div style={{ fontSize: fsCoord, color: '#444', lineHeight: density < 1 ? 1.25 : 1.5, fontStyle: 'italic' }}>
      <div style={{ fontWeight: 700, color: primary, fontSize: fsEntreprise, textTransform: 'uppercase', marginBottom: 2 * unit, fontStyle: 'italic' }}>
        {entreprise.nom || ''}
      </div>
      {entreprise.adresse && <div>{entreprise.adresse}</div>}
      {(entreprise.codePostal || entreprise.ville) && (
        <div>{entreprise.codePostal} {entreprise.ville}</div>
      )}
      {entreprise.telephone && <div>Tél : {entreprise.telephone}</div>}
      {entreprise.email && <div>{entreprise.email}</div>}
      {entreprise.siret && <div>SIRET : {entreprise.siret}</div>}
    </div>
  );

  // Bloc client — sur le bon d'intervention : nom uniquement (pas de coordonnées)
  const showClientCoords = true;
  const blocClient = (
    <div>
      <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 10 * unit, marginBottom: 2 * unit }}>
        {data.client.nom}
      </div>
      {showClientCoords && (
        <div style={{ fontSize: fsCoord, color: '#333', lineHeight: density < 1 ? 1.22 : 1.5, fontStyle: 'italic' }}>
          {data.client.adresse && <div>{data.client.adresse}</div>}
          {(data.client.codePostal || data.client.ville) && (
            <div>{data.client.codePostal} {data.client.ville}</div>
          )}
          {data.client.email && <div>{data.client.email}</div>}
          {data.client.telephone && <div>{data.client.telephone}</div>}
        </div>
      )}
    </div>
  );

  // Items du ruban
  const rubanItems = [
    { l: 'Référence', v: data.ref },
    { l: docType === 'facture' ? 'Date facture' : 'Date', v: formatDateFR(data.date) },
    ...(showEcheance ? [{ l: 'Échéance', v: data.echeance ? formatDateFR(data.echeance) : 'À réception' }] : []),
    ...(showValidite ? [{ l: 'Validité', v: data.validite ? formatDateFR(data.validite) : '30 jours' }] : []),
    ...(docType === 'intervention' ? [{ l: 'Type', v: data.type || '—' }] : []),
    ...(docType === 'intervention' ? [{ l: 'Technicien', v: data.technicien || '—' }] : []),
  ];

  return (
    <div style={pageStyle}>
      {/* ─── EN-TÊTE : LOGO + (TITRE ou ENTREPRISE) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11.2 * unit }}>
        <div>
          {t.logoUrl ? (
            <img
              src={t.logoUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ height: logoH, maxWidth: logoMaxW, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ height: logoH, width: logoMaxW * 0.7, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 * unit, color: '#999' }}>
              [Logo]
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {entrepriseEnFace ? (
            <>
              <div style={{ fontSize: titleSize, fontWeight: 700, fontStyle: 'italic', color: primary, lineHeight: 1.1 }}>
                {TITRES[docType]}
              </div>
              <div style={{ fontSize: fsCoord, color: '#666', fontStyle: 'italic', marginTop: 7 * unit }}>
                NUMÉRO : {data.ref}
              </div>
              <div style={{ fontSize: fsCoord, color: '#666', fontStyle: 'italic', marginTop: 1.5 * unit }}>
                DATE : {formatDateFR(data.date)}
              </div>
              {showEcheance && (
                <div style={{ fontSize: fsCoord, color: '#666', fontStyle: 'italic', marginTop: 1.5 * unit }}>
                  ÉCHÉANCE : {data.echeance ? formatDateFR(data.echeance) : 'À réception'}
                </div>
              )}
              {showValidite && (
                <div style={{ fontSize: fsCoord, color: '#666', fontStyle: 'italic', marginTop: 1.5 * unit }}>
                  VALIDITÉ : {data.validite ? formatDateFR(data.validite) : '30 jours'}
                </div>
              )}
              {docType === 'intervention' && data.technicien && (
                <div style={{ fontSize: fsCoord, color: '#666', fontStyle: 'italic', marginTop: 1.5 * unit }}>
                  TECHNICIEN : {data.technicien}
                </div>
              )}
            </>
          ) : (
            blocEntreprise
          )}
        </div>
      </div>

      {/* ─── TITRE (mode classique uniquement) ─── */}
      {!entrepriseEnFace && (
        <>
          <div style={{ fontSize: titleSize, fontWeight: 700, fontStyle: 'italic', color: primary, lineHeight: 1.1, marginBottom: 2 * unit }}>
            {TITRES[docType]}
          </div>
          <div style={{ fontSize: 8 * unit, color: '#666', fontStyle: 'italic', marginBottom: 12 * unit }}>
            NUMÉRO : {data.ref}
          </div>
        </>
      )}


      {/* ─── ENTREPRISE ↔ CLIENT côte-à-côte (mode par défaut) ─── */}
      {entrepriseEnFace ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 * unit, marginBottom: 11.2 * unit }}>
          <div style={{ flex: 1 }}>{blocEntreprise}</div>
          <div style={{ flex: 1, textAlign: 'right' }}>{blocClient}</div>
        </div>
      ) : (
        <div style={{ marginBottom: 11.2 * unit }}>{blocClient}</div>
      )}

      {/* ─── DESCRIPTION (intervention) ─── */}
      {docType === 'intervention' && data.description && (
        <div style={{ marginBottom: 12 * unit }}>
          <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 9.5 * unit, marginBottom: 2 * unit, borderBottom: '0.5px solid #ccc', paddingBottom: 2 * unit }}>
            Description
          </div>
          <div style={{ fontSize: 8.5 * unit, color: '#333', whiteSpace: 'pre-wrap' }}>{data.description}</div>
        </div>
      )}

      {/* ─── TABLEAU DES LIGNES ─── (masqué pour le bon d'intervention : pas de prix) */}
      {data.lignes.length > 0 && docType !== 'intervention' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fsTableLigne, marginBottom: 8 * unit, lineHeight: density < 1 ? 1.12 : 1.3 }}>
          <thead>
            <tr style={{ background: primary, color: '#fff', fontSize: fsTableHeader }}>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap' }}>Description</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap', width: 50 * unit }}>Réf</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap', width: 32 * unit }}>Qté</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap', width: 32 * unit }}>Unité</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap', width: 60 * unit }}>P.U.</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, whiteSpace: 'nowrap', width: 70 * unit }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {data.lignes.map((l, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 ? '#f7f7f7' : '#fff',
                  borderBottom: '0.5px solid #e0e0e0',
                }}
              >
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle' }}>{l.designation}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', color: '#888', verticalAlign: 'middle' }}>{l.ref || ''}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle' }}>{l.quantite}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle' }}>{l.unite || 'U'}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'middle' }}>{fmt(l.prixUnitaire)} €</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>{fmt(l.totalHT)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── Liste simplifiée pour le bon d'intervention (désignation + qté/unité, sans prix) ─── */}
      {data.lignes.length > 0 && docType === 'intervention' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fsTableLigne, marginBottom: 8 * unit, lineHeight: density < 1 ? 1.12 : 1.3 }}>
          <thead>
            <tr style={{ background: primary, color: '#fff', fontSize: fsTableHeader }}>
              <th style={{ padding: 4 * unit, textAlign: 'left', fontWeight: 700 }}>Travaux / Fournitures</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', fontWeight: 700, width: 50 * unit }}>Qté</th>
              <th style={{ padding: 4 * unit, textAlign: 'center', fontWeight: 700, width: 50 * unit }}>Unité</th>
            </tr>
          </thead>
          <tbody>
            {data.lignes.map((l, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f7f7f7' : '#fff', borderBottom: '0.5px solid #e0e0e0' }}>
                <td style={{ padding: 4 * unit, verticalAlign: 'top' }}>{l.designation}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'top' }}>{l.quantite}</td>
                <td style={{ padding: 4 * unit, textAlign: 'center', verticalAlign: 'top' }}>{l.unite || 'U'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── TOTAUX ─── */}
      {showTableTotals && (
        <div style={{ marginTop: 8 * unit, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 200 * unit, fontSize: fsTotaux }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: `${3 * unit}px 0` }}>
              <span style={{ flex: 1, color: '#555', fontStyle: 'italic' }}>TOTAL HT :</span>
              <span style={{ width: 70 * unit, textAlign: 'center', fontWeight: 700, fontStyle: 'italic' }}>{fmt(data.totaux.ht)} €</span>
            </div>
            {(data.totaux.tvaParTaux && data.totaux.tvaParTaux.length > 0
              ? data.totaux.tvaParTaux
              : [{ taux: 20, montant: data.totaux.tva }]
            ).map((tva, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: `${3 * unit}px 0` }}>
                <span style={{ flex: 1, color: '#555', fontStyle: 'italic' }}>TVA ({tva.taux}%) :</span>
                <span style={{ width: 70 * unit, textAlign: 'center', fontWeight: 700, fontStyle: 'italic' }}>{fmt(tva.montant)} €</span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: `${6 * unit}px 0`,
                borderTop: `0.75px solid ${primary}`,
                marginTop: 4 * unit,
                fontSize: fsTotalTTC,
              }}
            >
              <span style={{ flex: 1, fontWeight: 700, fontStyle: 'italic' }}>
                {data.paye ? 'TOTAL TTC PAYÉ' : 'TOTAL TTC :'}
              </span>
              <span style={{ width: 70 * unit, textAlign: 'center', fontWeight: 700, fontStyle: 'italic', color: primary }}>{fmt(data.totaux.ttc)} €</span>
            </div>
            {docType === 'facture' && !data.paye && data.resteAPayer != null && data.resteAPayer > 0 && data.resteAPayer < data.totaux.ttc && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${3 * unit}px 0`, fontSize: fsTotaux }}>
                <span style={{ color: accent, fontWeight: 700 }}>RESTE À PAYER :</span>
                <span style={{ color: accent, fontWeight: 700 }}>{fmt(data.resteAPayer)} €</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ACOMPTE (devis) ─── */}
      {showAcompte && data.totaux.ttc > 0 && (
        <div
          style={{
            marginTop: 14 * unit,
            padding: 8 * unit,
            border: `1px solid ${accent}`,
            background: `${accent}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            fontSize: 10 * unit,
            fontWeight: 700,
            fontStyle: 'italic',
          }}
        >
          ACOMPTE {tauxAcompte} % À PAYER À LA SIGNATURE — SOIT {fmt(acompte)} €
        </div>
      )}

      {/* ─── DEVIS : Récap totaux + Bon pour accord (uniquement devis, pas facture) ─── */}
      {docType === 'devis' && (
        <div style={{ marginTop: 12 * unit, display: 'flex', gap: 10 * unit, alignItems: 'stretch' }}>
          <div style={{ flex: 1, border: `1px solid ${primary}`, padding: 6 * unit, fontSize: fsEncartTexte }}>
            <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: fsEncartTexte * 1.05, marginBottom: 3 * unit, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Récapitulatif
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${1.5 * unit}px 0` }}>
              <span style={{ color: '#555', fontStyle: 'italic' }}>Total HT :</span>
              <span style={{ fontWeight: 700, fontStyle: 'italic' }}>{fmt(data.totaux.ht)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${1.5 * unit}px 0` }}>
              <span style={{ color: '#555', fontStyle: 'italic' }}>
                Total TVA ({(data.totaux.tvaParTaux?.[0]?.taux ?? 20)}%) :
              </span>
              <span style={{ fontWeight: 700, fontStyle: 'italic' }}>{fmt(data.totaux.tva)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${3 * unit}px 0 0`, marginTop: 2 * unit, fontSize: fsEncartTexte * 1.18 }}>
              <span style={{ fontWeight: 700, fontStyle: 'italic', color: primary }}>Total TTC :</span>
              <span style={{ fontWeight: 700, fontStyle: 'italic', color: primary }}>{fmt(data.totaux.ttc)} €</span>
            </div>
          </div>
          <div style={{ flex: 1, border: `1px solid ${primary}`, padding: 6 * unit, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: fsEncartTexte * 1.05, marginBottom: 2 * unit, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Bon pour accord
            </div>
            <div style={{ fontSize: fsEncartTexte * 0.88, color: '#666', marginBottom: 2 * unit }}>
              Date et signature précédées de la mention « Bon pour accord » :
            </div>
            <div style={{ flex: 1, minHeight: 30 * unit, borderTop: '0.5px dashed #999', marginTop: 2 * unit, width: '100%' }} />
          </div>
        </div>
      )}

      {showSignatures && (
        <div style={{ marginTop: 12 * unit, display: 'flex', gap: 10 * unit }}>
          <div style={{ flex: 1, border: `0.5px solid #ccc`, padding: 5 * unit, minHeight: 38 * unit }}>
            <div style={{ fontSize: 7.5 * unit, fontWeight: 700, fontStyle: 'italic', color: '#444', marginBottom: 3 * unit }}>
              Signature du technicien :
            </div>
            {data.signatureTech && (
              <img src={data.signatureTech} alt="" crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: 32 * unit, objectFit: 'contain' }} />
            )}
          </div>
          <div style={{ flex: 1, border: `0.5px solid #ccc`, padding: 5 * unit, minHeight: 38 * unit }}>
            <div style={{ fontSize: 7.5 * unit, fontWeight: 700, fontStyle: 'italic', color: '#444', marginBottom: 3 * unit }}>
              Signature du client :
            </div>
            {data.signatureClient && (
              <img src={data.signatureClient} alt="" crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: 32 * unit, objectFit: 'contain' }} />
            )}
          </div>
        </div>
      )}

      {/* ─── OBSERVATIONS (intervention) ─── */}
      {docType === 'intervention' && data.observations && (
        <div style={{ marginTop: 12 * unit }}>
          <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 9 * unit, marginBottom: 2 * unit }}>
            Observations :
          </div>
          <div style={{ fontSize: 8.5 * unit, color: '#444', whiteSpace: 'pre-wrap' }}>{data.observations}</div>
        </div>
      )}

      {/* ─── RIB ─── */}
      {t.afficherRib && docType !== 'intervention' && (
        <div style={{ marginTop: 14 * unit, fontSize: fsPaiement }}>
          <div style={{ fontWeight: 700, color: primary, marginBottom: 3 * unit }}>Moyens de paiement :</div>
          <div style={{ fontFamily: '"Courier New", Courier, monospace', color: '#333', lineHeight: 1.6 }}>
            <div>IBAN : FR76 1695 8000 0179 9683 5713 173</div>
            <div>BIC&nbsp;&nbsp;: QNTOFRP1XXX</div>
          </div>
        </div>
      )}

      {/* ─── PIED DE PAGE ─── */}
      <div
        style={{
          marginTop: 24 * unit,
          paddingTop: 6 * unit,
          borderTop: '0.5px solid #ccc',
          fontSize: fsPiedDePage,
          color: '#777',
          textAlign: 'center',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}
      >
        {t.piedDePage || ''}
        {(entreprise.tvaIntra || entreprise.capitalSocial || entreprise.rcs) && (
          <div style={{ marginTop: 3 * unit }}>
            {[
              entreprise.tvaIntra    && `TVA Intracommunautaire : ${entreprise.tvaIntra}`,
              entreprise.capitalSocial && `Capital social : ${entreprise.capitalSocial}`,
              entreprise.rcs         && `RCS : ${entreprise.rcs}`,
            ].filter(Boolean).join('  —  ')}
          </div>
        )}
      </div>
    </div>
  );
}
