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
  piedDePage?: string;
  afficherRib?: boolean;
}

export interface EntrepriseInfo {
  nom?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  telephone?: string;
  email?: string;
}

export interface DocumentTemplateProps {
  docType: DocType;
  data: DocumentTemplateData;
  template: DocumentTemplateCfg;
  entreprise?: EntrepriseInfo;
  /** Échelle d'affichage globale du document. Utiliser 1 pour le PDF. */
  scale?: number;
}

const A4_W_PX = (210 / 25.4) * 96;
const A4_H_PX = (297 / 25.4) * 96;

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
}: DocumentTemplateProps) {
  const W = A4_W_PX * scale;
  const H = A4_H_PX * scale;
  const mt = (t.margeHaut ?? 18) * scale;
  const mb = (t.margeBas ?? 20) * scale;
  const ml = (t.margeGauche ?? 15) * scale;
  const mr = (t.margeDroite ?? 15) * scale;
  const baseFontSize = (t.tailleTexte ?? 8.5) * scale * 1.2;
  const titleSize = (t.tailleTitre ?? 22) * scale;

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
    minHeight: H,
    background: '#fff',
    color: textColor,
    fontFamily,
    fontSize: baseFontSize,
    paddingTop: mt,
    paddingBottom: mb,
    paddingLeft: ml,
    paddingRight: mr,
    boxSizing: 'border-box',
    lineHeight: 1.4,
  };

  const showEcheance = docType === 'facture';
  const showValidite = docType === 'devis';
  const showAcompte = docType === 'devis';
  const showSignatures = docType === 'intervention';
  const showTableTotals = docType !== 'intervention' || (data.lignes && data.lignes.length > 0);
  const acompte = data.totaux.ttc * 0.3;

  return (
    <div style={pageStyle}>
      {/* ─── EN-TÊTE : LOGO + TITRE ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 * scale }}>
        <div>
          {t.logoUrl ? (
            <img
              src={t.logoUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ height: 50 * scale, maxWidth: 180 * scale, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div
              style={{
                height: 50 * scale,
                width: 130 * scale,
                background: '#eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10 * scale,
                color: '#999',
              }}
            >
              [Logo]
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 9 * scale, color: '#444', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: primary, fontSize: 11 * scale, textTransform: 'uppercase' }}>
            {entreprise.nom || ''}
          </div>
          {entreprise.adresse && <div>{entreprise.adresse}</div>}
          {(entreprise.codePostal || entreprise.ville) && (
            <div>
              {entreprise.codePostal} {entreprise.ville}
            </div>
          )}
          {entreprise.telephone && <div>Tél : {entreprise.telephone}</div>}
          {entreprise.email && <div>{entreprise.email}</div>}
          {entreprise.siret && <div>SIRET : {entreprise.siret}</div>}
        </div>
      </div>

      {/* ─── TITRE ─── */}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 700,
          fontStyle: 'italic',
          color: primary,
          lineHeight: 1.1,
          marginBottom: 2 * scale,
        }}
      >
        {TITRES[docType]}
      </div>
      <div style={{ fontSize: 8 * scale, color: '#666', fontStyle: 'italic', marginBottom: 12 * scale }}>
        NUMÉRO : {data.ref}
      </div>

      {/* ─── BANDEAU INFOS ─── */}
      <div
        style={{
          display: 'flex',
          background: primary,
          color: '#fff',
          marginBottom: 14 * scale,
        }}
      >
        {[
          { l: 'Référence', v: data.ref },
          { l: docType === 'facture' ? 'Date facture' : docType === 'devis' ? 'Date' : 'Date', v: formatDateFR(data.date) },
          ...(showEcheance ? [{ l: 'Échéance', v: data.echeance ? formatDateFR(data.echeance) : 'À réception' }] : []),
          ...(showValidite ? [{ l: 'Validité', v: data.validite ? formatDateFR(data.validite) : '30 jours' }] : []),
          ...(docType === 'intervention' ? [{ l: 'Type', v: data.type || '—' }] : []),
          ...(docType === 'intervention' ? [{ l: 'Technicien', v: data.technicien || '—' }] : []),
        ].map((c, i, arr) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: `${5 * scale}px ${7 * scale}px`,
              borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 6.5 * scale, color: '#ccc', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {c.l}
            </div>
            <div style={{ fontSize: 8.5 * scale, fontWeight: 700, marginTop: 1 * scale }}>{c.v}</div>
          </div>
        ))}
      </div>

      {/* ─── CLIENT ─── */}
      <div style={{ marginBottom: 14 * scale }}>
        <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 10 * scale, marginBottom: 2 * scale }}>
          {data.client.nom}
        </div>
        <div style={{ fontSize: 8.5 * scale, color: '#333', lineHeight: 1.5 }}>
          {data.client.adresse && <div>{data.client.adresse}</div>}
          {(data.client.codePostal || data.client.ville) && (
            <div>
              {data.client.codePostal} {data.client.ville}
            </div>
          )}
          {data.client.email && <div>{data.client.email}</div>}
          {data.client.telephone && <div>{data.client.telephone}</div>}
        </div>
      </div>

      {/* ─── DESCRIPTION (intervention) ─── */}
      {docType === 'intervention' && data.description && (
        <div style={{ marginBottom: 12 * scale }}>
          <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 9.5 * scale, marginBottom: 2 * scale, borderBottom: '0.5px solid #ccc', paddingBottom: 2 * scale }}>
            Description
          </div>
          <div style={{ fontSize: 8.5 * scale, color: '#333', whiteSpace: 'pre-wrap' }}>{data.description}</div>
        </div>
      )}

      {/* ─── TABLEAU DES LIGNES ─── */}
      {data.lignes.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 * scale, marginBottom: 8 * scale }}>
          <thead>
            <tr style={{ background: primary, color: '#fff' }}>
              <th style={{ padding: 4 * scale, textAlign: 'left', fontWeight: 700 }}>Description</th>
              <th style={{ padding: 4 * scale, textAlign: 'center', fontWeight: 700, width: 50 * scale }}>Réf</th>
              <th style={{ padding: 4 * scale, textAlign: 'center', fontWeight: 700, width: 32 * scale }}>Qté</th>
              <th style={{ padding: 4 * scale, textAlign: 'center', fontWeight: 700, width: 32 * scale }}>Unité</th>
              <th style={{ padding: 4 * scale, textAlign: 'right', fontWeight: 700, width: 60 * scale }}>P.U.</th>
              <th style={{ padding: 4 * scale, textAlign: 'center', fontWeight: 700, width: 36 * scale }}>TVA</th>
              <th style={{ padding: 4 * scale, textAlign: 'right', fontWeight: 700, width: 70 * scale }}>Montant</th>
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
                <td style={{ padding: 4 * scale, verticalAlign: 'top' }}>{l.designation}</td>
                <td style={{ padding: 4 * scale, textAlign: 'center', color: '#888', verticalAlign: 'top' }}>{l.ref || ''}</td>
                <td style={{ padding: 4 * scale, textAlign: 'center', verticalAlign: 'top' }}>{l.quantite}</td>
                <td style={{ padding: 4 * scale, textAlign: 'center', verticalAlign: 'top' }}>{l.unite || 'U'}</td>
                <td style={{ padding: 4 * scale, textAlign: 'right', verticalAlign: 'top' }}>{fmt(l.prixUnitaire)} €</td>
                <td style={{ padding: 4 * scale, textAlign: 'center', verticalAlign: 'top' }}>{l.tauxTVA}%</td>
                <td style={{ padding: 4 * scale, textAlign: 'right', fontWeight: 700, verticalAlign: 'top' }}>{fmt(l.totalHT)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── TOTAUX ─── */}
      {showTableTotals && (
        <div style={{ marginTop: 8 * scale, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 200 * scale, fontSize: 9.5 * scale }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${3 * scale}px 0` }}>
              <span style={{ color: '#555', fontStyle: 'italic' }}>TOTAL HT :</span>
              <span style={{ fontWeight: 700 }}>{fmt(data.totaux.ht)} €</span>
            </div>
            {(data.totaux.tvaParTaux && data.totaux.tvaParTaux.length > 0
              ? data.totaux.tvaParTaux
              : [{ taux: 20, montant: data.totaux.tva }]
            ).map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: `${3 * scale}px 0` }}>
                <span style={{ color: '#555', fontStyle: 'italic' }}>TVA ({t.taux}%) :</span>
                <span style={{ fontWeight: 700 }}>{fmt(t.montant)} €</span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: `${6 * scale}px 0`,
                borderTop: `1.5px solid ${primary}`,
                marginTop: 4 * scale,
                fontSize: 11 * scale,
              }}
            >
              <span style={{ fontWeight: 700, fontStyle: 'italic' }}>
                {data.paye ? 'TOTAL TTC PAYÉ' : 'TOTAL TTC :'}
              </span>
              <span style={{ fontWeight: 700, color: primary }}>{fmt(data.totaux.ttc)} €</span>
            </div>
            {docType === 'facture' && !data.paye && data.resteAPayer != null && data.resteAPayer > 0 && data.resteAPayer < data.totaux.ttc && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${3 * scale}px 0`, fontSize: 9.5 * scale }}>
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
            marginTop: 14 * scale,
            padding: 8 * scale,
            border: `2px solid ${accent}`,
            background: `${accent}10`,
            textAlign: 'center',
            color: accent,
            fontSize: 10 * scale,
            fontWeight: 700,
            fontStyle: 'italic',
          }}
        >
          ⚠ ACOMPTE 30 % À PAYER À LA SIGNATURE — SOIT {fmt(acompte)} €
        </div>
      )}

      {/* ─── SIGNATURES (intervention) ─── */}
      {showSignatures && (
        <div style={{ marginTop: 14 * scale, display: 'flex', gap: 10 * scale }}>
          <div style={{ flex: 1, border: '1px solid #ccc', padding: 6 * scale, minHeight: 60 * scale }}>
            <div style={{ fontSize: 7.5 * scale, fontWeight: 700, fontStyle: 'italic', color: '#444', marginBottom: 4 * scale }}>
              Signature du technicien :
            </div>
            {data.signatureTech && (
              <img src={data.signatureTech} alt="" crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: 50 * scale, objectFit: 'contain' }} />
            )}
          </div>
          <div style={{ flex: 1, border: '1px solid #ccc', padding: 6 * scale, minHeight: 60 * scale }}>
            <div style={{ fontSize: 7.5 * scale, fontWeight: 700, fontStyle: 'italic', color: '#444', marginBottom: 4 * scale }}>
              Signature du client (bon pour accord) :
            </div>
            {data.signatureClient && (
              <img src={data.signatureClient} alt="" crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: 50 * scale, objectFit: 'contain' }} />
            )}
          </div>
        </div>
      )}

      {/* ─── OBSERVATIONS (intervention) ─── */}
      {docType === 'intervention' && data.observations && (
        <div style={{ marginTop: 12 * scale }}>
          <div style={{ fontWeight: 700, fontStyle: 'italic', color: primary, fontSize: 9 * scale, marginBottom: 2 * scale }}>
            Observations :
          </div>
          <div style={{ fontSize: 8.5 * scale, color: '#444', whiteSpace: 'pre-wrap' }}>{data.observations}</div>
        </div>
      )}

      {/* ─── RIB ─── */}
      {t.afficherRib && (
        <div style={{ marginTop: 14 * scale, fontSize: 9 * scale }}>
          <div style={{ fontWeight: 700, color: primary, marginBottom: 3 * scale }}>Moyens de paiement :</div>
          <div style={{ fontFamily: '"Courier New", Courier, monospace', color: '#333', lineHeight: 1.6 }}>
            <div>IBAN : FR76 1695 8000 0179 9683 5713 173</div>
            <div>BIC&nbsp;&nbsp;: QNTOFRP1XXX</div>
          </div>
        </div>
      )}

      {/* ─── PIED DE PAGE ─── */}
      <div
        style={{
          marginTop: 24 * scale,
          paddingTop: 6 * scale,
          borderTop: '0.5px solid #ccc',
          fontSize: 7 * scale,
          color: '#777',
          textAlign: 'center',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}
      >
        {t.piedDePage ||
          "Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO — Contrat n° 24015161184."}
      </div>
    </div>
  );
}
