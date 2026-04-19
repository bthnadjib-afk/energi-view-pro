/**
 * reactPdf.tsx — Génération PDF vectorielle via @react-pdf/renderer.
 * Remplace html2canvas + jsPDF pour tous les documents (facture, devis, intervention).
 * Le texte est vectoriel → qualité identique à n'importe quel zoom, taille de fichier réduite.
 */
import React from 'react';
import { Document, Page, View, Text, Image, pdf } from '@react-pdf/renderer';
import type {
  DocumentTemplateData,
  DocumentTemplateCfg,
  DocType,
  EntrepriseInfo,
} from './DocumentTemplate';

// ─── Polices PDF intégrées (pas de téléchargement) ─────────────────────────
const H   = 'Helvetica';
const HB  = 'Helvetica-Bold';
const HO  = 'Helvetica-Oblique';
const HBO = 'Helvetica-BoldOblique';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d?: string) => {
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

// ─── Composant principal ─────────────────────────────────────────────────────
interface DocPDFProps {
  docType: DocType;
  data: DocumentTemplateData;
  t: DocumentTemplateCfg;
  ent: EntrepriseInfo;
}

function DocPDF({ docType, data, t, ent }: DocPDFProps) {
  const primary       = t.couleurPrimaire      || '#1a1a1a';
  const accent        = t.couleurAccent        || '#cc0000';
  const tableHeaderBg = t.couleurTableauHeader || primary;
  const devise        = t.devise               || '€';

  const ML = t.margeGauche ?? 15;
  const MR = t.margeDroite ?? 15;
  const MT = t.margeHaut   ?? 18;
  const MB = t.margeBas    ?? 20;

  const logoH    = (t.logoHauteur   ?? 13) * 2.835;
  const logoMaxW = (t.logoLargeurMax ?? 48) * 2.835;

  const showEcheance   = docType === 'facture';
  const showValidite   = docType === 'devis';
  const showSignatures = docType === 'intervention';
  const showTotals     = docType !== 'intervention';
  const showAcompte    = docType === 'devis';
  const showRecap      = docType === 'devis';

  const tauxAcompte =
    t.seuilAcompte && t.seuilAcompte > 0 && data.totaux.ttc > t.seuilAcompte
      ? (t.tauxAcompteSeuilDepasse ?? 50)
      : (t.tauxAcompte ?? 30);
  const acompte = data.totaux.ttc * (tauxAcompte / 100);

  const wantsCgv =
    (docType === 'devis' || docType === 'facture') &&
    t.afficherCgv !== false &&
    !!(t.texteCgv?.trim());

  const pageStyle = {
    paddingTop:    `${MT}mm`,
    paddingBottom: `${MB}mm`,
    paddingLeft:   `${ML}mm`,
    paddingRight:  `${MR}mm`,
    fontFamily: H,
    fontSize: 9,
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
  } as const;

  const tvaRows =
    data.totaux.tvaParTaux && data.totaux.tvaParTaux.length > 0
      ? data.totaux.tvaParTaux
      : [{ taux: 20, montant: data.totaux.tva }];

  return (
    <Document>
      <Page size="A4" style={pageStyle} wrap>

        {/* ── EN-TÊTE : logo gauche | titre + méta droite ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View>
            {t.logoUrl ? (
              <Image src={t.logoUrl} style={{ height: logoH, maxWidth: logoMaxW }} />
            ) : (
              <View style={{ height: logoH, width: logoMaxW * 0.7, backgroundColor: '#eeeeee', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 8, color: '#999999' }}>[Logo]</Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: HB, fontSize: 20, color: primary }}>{TITRES[docType]}</Text>
            <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 4 }}>N° {data.ref}</Text>
            <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 2 }}>
              {docType === 'facture' ? 'Date facture' : 'Date'} : {fmtDate(data.date)}
            </Text>
            {showEcheance && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 2 }}>
                Échéance : {data.echeance ? fmtDate(data.echeance) : 'À réception'}
              </Text>
            )}
            {showValidite && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 2 }}>
                Validité : {data.validite ? fmtDate(data.validite) : '30 jours'}
              </Text>
            )}
            {docType === 'intervention' && data.type && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 2 }}>Type : {data.type}</Text>
            )}
            {docType === 'intervention' && data.technicien && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#666666', marginTop: 2 }}>Technicien : {data.technicien}</Text>
            )}
          </View>
        </View>

        {/* ── ENTREPRISE | CLIENT ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: HB, fontSize: 11, color: primary }}>{ent.nom || ''}</Text>
            {ent.adresse && <Text style={{ fontFamily: HO, fontSize: 8, color: '#444444', marginTop: 2 }}>{ent.adresse}</Text>}
            {(ent.codePostal || ent.ville) && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#444444' }}>{ent.codePostal} {ent.ville}</Text>
            )}
            {ent.telephone && <Text style={{ fontFamily: HO, fontSize: 8, color: '#444444' }}>Tél : {ent.telephone}</Text>}
            {ent.email && <Text style={{ fontFamily: HO, fontSize: 8, color: '#444444' }}>{ent.email}</Text>}
            {ent.siret && <Text style={{ fontFamily: HO, fontSize: 8, color: '#444444' }}>SIRET : {ent.siret}</Text>}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: HB, fontSize: 10, color: primary }}>{data.client.nom}</Text>
            {data.client.adresse && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#333333', marginTop: 2 }}>{data.client.adresse}</Text>
            )}
            {(data.client.codePostal || data.client.ville) && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#333333' }}>
                {data.client.codePostal} {data.client.ville}
              </Text>
            )}
            {data.client.email && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#333333' }}>{data.client.email}</Text>
            )}
            {data.client.telephone && (
              <Text style={{ fontFamily: HO, fontSize: 8, color: '#333333' }}>{data.client.telephone}</Text>
            )}
          </View>
        </View>

        {/* ── DESCRIPTION (intervention) ── */}
        {docType === 'intervention' && data.description && (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontFamily: HBO, fontSize: 9, color: primary, borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingBottom: 2, marginBottom: 3 }}>
              Description
            </Text>
            <Text style={{ fontSize: 8.5, color: '#333333' }}>{data.description}</Text>
          </View>
        )}

        {/* ── TABLEAU FACTURE / DEVIS ── */}
        {data.lignes.length > 0 && docType !== 'intervention' && (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', backgroundColor: tableHeaderBg, paddingHorizontal: 4, paddingVertical: 5 }}>
              <Text style={{ flex: 1,    fontFamily: HB, fontSize: 8, color: '#ffffff' }}>Description</Text>
              <Text style={{ width: 38,  fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'center' }}>Réf</Text>
              <Text style={{ width: 24,  fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'center' }}>Qté</Text>
              <Text style={{ width: 28,  fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'center' }}>Unité</Text>
              <Text style={{ width: 52,  fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'right' }}>P.U. HT</Text>
              <Text style={{ width: 55,  fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'right' }}>Total HT</Text>
            </View>
            {data.lignes.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 ? '#f7f7f7' : '#ffffff', paddingHorizontal: 4, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' }}>
                <Text style={{ flex: 1,   fontFamily: H, fontSize: 8 }}>{l.designation}</Text>
                <Text style={{ width: 38, fontFamily: H, fontSize: 8, color: '#888888', textAlign: 'center' }}>{l.ref || ''}</Text>
                <Text style={{ width: 24, fontFamily: H, fontSize: 8, textAlign: 'center' }}>{l.quantite}</Text>
                <Text style={{ width: 28, fontFamily: H, fontSize: 8, textAlign: 'center' }}>{l.unite || 'U'}</Text>
                <Text style={{ width: 52, fontFamily: H, fontSize: 8, textAlign: 'right' }}>{fmt(l.prixUnitaire)} {devise}</Text>
                <Text style={{ width: 55, fontFamily: HB, fontSize: 8, textAlign: 'right' }}>{fmt(l.totalHT)} {devise}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TABLEAU INTERVENTION (sans prix) ── */}
        {data.lignes.length > 0 && docType === 'intervention' && (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', backgroundColor: tableHeaderBg, paddingHorizontal: 4, paddingVertical: 5 }}>
              <Text style={{ flex: 1,   fontFamily: HB, fontSize: 8, color: '#ffffff' }}>Travaux / Fournitures</Text>
              <Text style={{ width: 35, fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'center' }}>Qté</Text>
              <Text style={{ width: 35, fontFamily: HB, fontSize: 8, color: '#ffffff', textAlign: 'center' }}>Unité</Text>
            </View>
            {data.lignes.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 ? '#f7f7f7' : '#ffffff', paddingHorizontal: 4, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' }}>
                <Text style={{ flex: 1,   fontFamily: H, fontSize: 8 }}>{l.designation}</Text>
                <Text style={{ width: 35, fontFamily: H, fontSize: 8, textAlign: 'center' }}>{l.quantite}</Text>
                <Text style={{ width: 35, fontFamily: H, fontSize: 8, textAlign: 'center' }}>{l.unite || 'U'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TOTAUX ── */}
        {showTotals && (
          <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
            <View style={{ minWidth: 160 }}>
              <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
                <Text style={{ flex: 1, fontFamily: HO, fontSize: 8, color: '#555555' }}>TOTAL HT :</Text>
                <Text style={{ width: 75, fontFamily: HB, fontSize: 8, textAlign: 'right' }}>{fmt(data.totaux.ht)} {devise}</Text>
              </View>
              {tvaRows.map((tva, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 2 }}>
                  <Text style={{ flex: 1, fontFamily: HO, fontSize: 8, color: '#555555' }}>TVA ({tva.taux}%) :</Text>
                  <Text style={{ width: 75, fontFamily: HB, fontSize: 8, textAlign: 'right' }}>{fmt(tva.montant)} {devise}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', paddingVertical: 4, borderTopWidth: 0.75, borderTopColor: '#1a1a1a', marginTop: 2 }}>
                <Text style={{ flex: 1, fontFamily: HB, fontSize: 10, color: primary }}>
                  {data.paye ? 'TOTAL TTC PAYÉ' : 'TOTAL TTC :'}
                </Text>
                <Text style={{ width: 75, fontFamily: HB, fontSize: 10, color: primary, textAlign: 'right' }}>
                  {fmt(data.totaux.ttc)} {devise}
                </Text>
              </View>
              {docType === 'facture' && !data.paye && data.resteAPayer != null && data.resteAPayer > 0 && data.resteAPayer < data.totaux.ttc && (
                <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
                  <Text style={{ flex: 1, fontFamily: HB, fontSize: 8, color: accent }}>RESTE À PAYER :</Text>
                  <Text style={{ width: 75, fontFamily: HB, fontSize: 8, color: accent, textAlign: 'right' }}>{fmt(data.resteAPayer)} {devise}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── ACOMPTE (devis) ── */}
        {showAcompte && data.totaux.ttc > 0 && (
          <View style={{ marginBottom: 8, padding: 8, borderWidth: 1, borderColor: accent, alignItems: 'center' }}>
            <Text style={{ fontFamily: HBO, fontSize: 9, color: accent }}>
              ACOMPTE {tauxAcompte}% À PAYER À LA SIGNATURE — SOIT {fmt(acompte)} {devise}
            </Text>
          </View>
        )}

        {/* ── RÉCAPITULATIF + BON POUR ACCORD (devis) ── */}
        {showRecap && (
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {/* Récapitulatif */}
            <View style={{ flex: 1, borderWidth: 1, borderColor: primary, padding: 6, marginRight: 5 }}>
              <Text style={{ fontFamily: HBO, fontSize: 8, color: primary, textDecoration: 'underline', textAlign: 'center', marginBottom: 5 }}>
                RÉCAPITULATIF
              </Text>
              <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
                <Text style={{ flex: 1, fontFamily: HO, fontSize: 8, color: '#555555' }}>Total HT :</Text>
                <Text style={{ fontFamily: HB, fontSize: 8 }}>{fmt(data.totaux.ht)} {devise}</Text>
              </View>
              <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
                <Text style={{ flex: 1, fontFamily: HO, fontSize: 8, color: '#555555' }}>
                  Total TVA ({tvaRows[0]?.taux ?? 20}%) :
                </Text>
                <Text style={{ fontFamily: HB, fontSize: 8 }}>{fmt(data.totaux.tva)} {devise}</Text>
              </View>
              <View style={{ flexDirection: 'row', paddingVertical: 3, marginTop: 2, borderTopWidth: 0.5, borderTopColor: primary }}>
                <Text style={{ flex: 1, fontFamily: HB, fontSize: 9, color: primary }}>Total TTC :</Text>
                <Text style={{ fontFamily: HB, fontSize: 9, color: primary }}>{fmt(data.totaux.ttc)} {devise}</Text>
              </View>
            </View>
            {/* Bon pour accord */}
            <View style={{ flex: 1, borderWidth: 1, borderColor: primary, padding: 6, alignItems: 'center' }}>
              <Text style={{ fontFamily: HBO, fontSize: 8, color: primary, textDecoration: 'underline', marginBottom: 4 }}>
                BON POUR ACCORD
              </Text>
              <Text style={{ fontFamily: HO, fontSize: 7, color: '#666666', marginBottom: 6, textAlign: 'center' }}>
                Date et signature précédées de la mention « Bon pour accord » :
              </Text>
              <View style={{ flex: 1, minHeight: 25, borderTopWidth: 0.5, borderTopColor: '#999999', width: '100%' }} />
            </View>
          </View>
        )}

        {/* ── SIGNATURES (intervention) ── */}
        {showSignatures && (
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: '#cccccc', padding: 5, minHeight: 55, marginRight: 5 }}>
              <Text style={{ fontFamily: HBO, fontSize: 7.5, color: '#444444', marginBottom: 4 }}>Signature du technicien :</Text>
              {data.signatureTech && (
                <Image src={data.signatureTech} style={{ maxHeight: 45, objectFit: 'contain' }} />
              )}
            </View>
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: '#cccccc', padding: 5, minHeight: 55 }}>
              <Text style={{ fontFamily: HBO, fontSize: 7.5, color: '#444444', marginBottom: 4 }}>Signature du client :</Text>
              {data.signatureClient && (
                <Image src={data.signatureClient} style={{ maxHeight: 45, objectFit: 'contain' }} />
              )}
            </View>
          </View>
        )}

        {/* ── OBSERVATIONS (intervention) ── */}
        {docType === 'intervention' && data.observations && (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontFamily: HB, fontSize: 9, color: primary, marginBottom: 2 }}>Observations :</Text>
            <Text style={{ fontSize: 8.5, color: '#444444' }}>{data.observations}</Text>
          </View>
        )}

        {/* ── RIB ── */}
        {t.afficherRib && docType !== 'intervention' && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontFamily: HB, fontSize: 9, color: primary, marginBottom: 3 }}>Moyens de paiement :</Text>
            <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#333333' }}>IBAN : FR76 1695 8000 0179 9683 5713 173</Text>
            <Text style={{ fontFamily: 'Courier', fontSize: 8, color: '#333333' }}>BIC  : QNTOFRP1XXX</Text>
          </View>
        )}

        {/* ── PIED DE PAGE (fixe sur chaque page) ── */}
        {t.piedDePage && (
          <Text
            style={{ position: 'absolute', bottom: `${MB / 2}mm`, left: `${ML}mm`, right: `${MR}mm`, fontFamily: HO, fontSize: 7, color: '#999999', textAlign: 'center' }}
            fixed
          >
            {t.piedDePage}
          </Text>
        )}

        {/* ── NUMÉRO DE PAGE (bas droite, fixe, si > 1 page) ── */}
        <Text
          style={{ position: 'absolute', bottom: `${MB / 4}mm`, right: `${MR}mm`, fontFamily: H, fontSize: 7, color: '#aaaaaa' }}
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${pageNumber}/${totalPages}` : '')}
          fixed
        />
      </Page>

      {/* ── PAGE CGV ── */}
      {wantsCgv && (
        <Page size="A4" style={pageStyle}>
          <Text style={{ fontFamily: HB, fontSize: 13, color: primary, borderBottomWidth: 0.75, borderBottomColor: primary, paddingBottom: 4, marginBottom: 10 }}>
            Conditions Générales de Vente
          </Text>
          <Text style={{ fontSize: 8, color: '#333333', lineHeight: 1.5 }}>{t.texteCgv}</Text>
        </Page>
      )}
    </Document>
  );
}

// ─── Lecture config depuis localStorage ─────────────────────────────────────
function readCfg(): DocumentTemplateCfg {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('electropro-config') : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const tpl = (parsed?.template as DocumentTemplateCfg) || {};
    const def = parsed?.defaults || {};
    if (def.tauxAcompte             !== undefined) tpl.tauxAcompte             = def.tauxAcompte;
    if (def.seuilAcompte            !== undefined) tpl.seuilAcompte            = def.seuilAcompte;
    if (def.tauxAcompteSeuilDepasse !== undefined) tpl.tauxAcompteSeuilDepasse = def.tauxAcompteSeuilDepasse;
    if (def.devise                  !== undefined) tpl.devise                  = def.devise;
    return tpl;
  } catch { return {}; }
}

function readEnt(): EntrepriseInfo {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('electropro-config') : null;
    if (!raw) return {};
    return JSON.parse(raw)?.entreprise || {};
  } catch { return {}; }
}

// ─── API publique ────────────────────────────────────────────────────────────
export interface BuildPdfParams {
  docType: DocType;
  data: DocumentTemplateData;
  templateOverride?: DocumentTemplateCfg;
  entrepriseOverride?: EntrepriseInfo;
}

export async function buildPdfBlob(params: BuildPdfParams): Promise<Blob> {
  const t   = params.templateOverride ?? readCfg();
  const ent = params.entrepriseOverride ?? readEnt();
  const element = React.createElement(DocPDF, { docType: params.docType, data: params.data, t, ent });
  return await pdf(element).toBlob();
}

export async function buildPdfBase64(params: BuildPdfParams): Promise<string> {
  const blob = await buildPdfBlob(params);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function openPdf(params: BuildPdfParams): Promise<void> {
  const blob = await buildPdfBlob(params);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export async function downloadPdf(params: BuildPdfParams, filename: string): Promise<void> {
  const blob = await buildPdfBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function pdfToBlobUrl(params: BuildPdfParams): Promise<string> {
  const blob = await buildPdfBlob(params);
  return URL.createObjectURL(blob);
}
