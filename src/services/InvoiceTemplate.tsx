/**
 * InvoiceTemplate.tsx — Facture PDF via @react-pdf/renderer
 * Design basé sur la référence EDG-FACTURE-ACCOMPTE-PCMG-V33
 * Utilise Helvetica (police intégrée PDF) pour éviter le chargement de fonts externes.
 */
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Facture, DevisLigne, Client } from '@/services/dolibarr';
// Import statique du logo (Vite transforme en data-URL ou chemin)
// @ts-ignore
import logoSrc from '@/assets/logo.png';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EntrepriseInfo {
  nom?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  telephone?: string;
  email?: string;
  iban?: string;
  bic?: string;
}

export interface InvoiceTemplateProps {
  facture: Facture;
  client?: Client;
  entreprise?: EntrepriseInfo;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  const num = typeof n === 'number' && isFinite(n) ? n : 0;
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateFR(s: string | undefined | null): string {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function txt(v: string | null | undefined): string {
  return v ?? '';
}

// ─── Palette & constantes ────────────────────────────────────────────────────

const NOIR   = '#1a1a1a';
const BLANC  = '#ffffff';
const GRIS_L = '#f4f4f4';  // lignes paires tableau
const GRIS_T = '#555555';  // texte secondaire
const GRIS_B = '#cccccc';  // bordures légères

// ─── StyleSheet ─────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: NOIR,
    backgroundColor: BLANC,
    paddingTop: 18,
    paddingBottom: 22,
    paddingLeft: 15,
    paddingRight: 15,
    flexDirection: 'column',
  },

  // ── Logo ──
  logo: { width: 58, height: 22, objectFit: 'contain', marginBottom: 6 },

  // ── Titre ──
  titre: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 22,
    color: NOIR,
    marginBottom: 2,
  },
  refLine: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8,
    color: GRIS_T,
    marginBottom: 7,
  },

  // ── Barre info (fond noir) ──
  infoBar: {
    flexDirection: 'row',
    backgroundColor: NOIR,
    marginBottom: 8,
    borderRadius: 1,
  },
  infoCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRight: `0.5pt solid #444444`,
  },
  infoCellLast: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 6.5,
    color: '#aaaaaa',
    marginBottom: 1,
  },
  infoValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: BLANC,
  },

  // ── Parties ──
  parties: { flexDirection: 'row', marginBottom: 8 },
  partyLeft: { flex: 1, paddingRight: 6 },
  partyRight: { flex: 1, paddingLeft: 6 },
  partyLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: GRIS_T,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  partyName: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9,
    color: NOIR,
    marginBottom: 2,
  },
  partyInfo: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#333333',
    lineHeight: 1.55,
  },

  // ── Tableau ──
  tableHeader: {
    flexDirection: 'row',
    borderTop: `1.5pt solid ${NOIR}`,
    borderBottom: `1.5pt solid ${NOIR}`,
    paddingVertical: 3,
    backgroundColor: BLANC,
  },
  sectionRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 2,
    backgroundColor: BLANC,
  },
  sectionText: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 8.5,
    color: NOIR,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottom: `0.3pt solid ${GRIS_B}`,
    minHeight: 14,
  },
  dataRowAlt: {
    flexDirection: 'row',
    borderBottom: `0.3pt solid ${GRIS_B}`,
    backgroundColor: GRIS_L,
    minHeight: 14,
  },

  // Cellules entête
  thDesc:  { width: '43%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'left' },
  thRef:   { width: '9%',  fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'center' },
  thQte:   { width: '7%',  fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'center' },
  thUnit:  { width: '7%',  fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'center' },
  thPrix:  { width: '17%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'right' },
  thMont:  { width: '17%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 3, textAlign: 'right' },

  // Cellules données
  tdDesc:  { width: '43%', fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'left' },
  tdRef:   { width: '9%',  fontFamily: 'Helvetica', fontSize: 7.5, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'center', color: GRIS_T },
  tdQte:   { width: '7%',  fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'center' },
  tdUnit:  { width: '7%',  fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'center' },
  tdPrix:  { width: '17%', fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'right' },
  tdMont:  { width: '17%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingVertical: 2.5, textAlign: 'right' },

  // ── Séparateurs ──
  sepThin: { borderBottom: `0.5pt solid ${GRIS_B}`, marginVertical: 4 },
  sepBold: { borderBottom: `1.5pt solid ${NOIR}`, marginVertical: 0 },

  // ── Zone date + totaux ──
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  dateNote: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7.5,
    color: GRIS_T,
    lineHeight: 1.7,
    flex: 1,
  },
  totauxBlock: {
    alignItems: 'flex-end',
    flex: 1,
  },
  totLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 1,
    gap: 10,
  },
  totLabel: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
    color: GRIS_T,
    textAlign: 'right',
    minWidth: 50,
  },
  totValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: NOIR,
    textAlign: 'right',
    minWidth: 28,
  },
  totValueLarge: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: NOIR,
    textAlign: 'right',
    minWidth: 28,
    paddingTop: 1,
  },
  totLabelLarge: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9.5,
    color: NOIR,
    textAlign: 'right',
    minWidth: 50,
    paddingTop: 1,
  },

  // ── Montant principal ──
  montantBlock: { paddingVertical: 7 },
  montantLabel: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 20,
    color: NOIR,
    lineHeight: 1.2,
  },

  // ── RIB ──
  ribBlock: { marginTop: 4, marginBottom: 4 },
  ribTitre: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: NOIR,
    marginBottom: 2,
  },
  ribData: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#333333',
    lineHeight: 1.7,
  },

  // ── Footer ──
  footer: {
    marginTop: 'auto',
    paddingTop: 3,
    borderTop: `0.5pt solid ${GRIS_B}`,
    fontFamily: 'Helvetica-Oblique',
    fontSize: 6.5,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 1.7,
  },
});

// ─── Sous-composants ─────────────────────────────────────────────────────────

/** Ligne de données du tableau */
function DataRow({ ligne, index }: { ligne: DevisLigne; index: number }) {
  const style = index % 2 === 1 ? S.dataRowAlt : S.dataRow;
  return (
    <View style={style} wrap={false}>
      <Text style={S.tdDesc}>{txt(ligne.designation)}</Text>
      <Text style={S.tdRef}>{txt(ligne.ref)}</Text>
      <Text style={S.tdQte}>{txt(String(ligne.quantite ?? ''))}</Text>
      <Text style={S.tdUnit}>{ligne.unite || 'U'}</Text>
      <Text style={S.tdPrix}>{fmt(ligne.prixUnitaire)} €</Text>
      <Text style={S.tdMont}>{fmt(ligne.totalHT)} €</Text>
    </View>
  );
}

/** En-tête de section (Main d'œuvre / Fournitures) */
function SectionRow({ label }: { label: string }) {
  return (
    <View style={S.sectionRow}>
      <Text style={S.sectionText}>{label}</Text>
    </View>
  );
}

/** Tableau des lignes avec sections */
function LignesTable({ lignes }: { lignes: DevisLigne[] }) {
  const mo  = lignes.filter(l => l.productType === 'main_oeuvre');
  const fo  = lignes.filter(l => l.productType === 'fourniture');
  const mix = lignes.filter(l => l.productType !== 'main_oeuvre' && l.productType !== 'fourniture');

  const hasSections = mo.length > 0 || fo.length > 0;
  let globalIndex = 0;

  return (
    <View>
      {/* Entête */}
      <View style={S.tableHeader}>
        <Text style={S.thDesc}>Description</Text>
        <Text style={S.thRef}>Réf</Text>
        <Text style={S.thQte}>Qté</Text>
        <Text style={S.thUnit}>Unité</Text>
        <Text style={S.thPrix}>Prix unitaire</Text>
        <Text style={S.thMont}>Montant</Text>
      </View>

      {hasSections ? (
        <>
          {mo.length > 0 && (
            <>
              <SectionRow label="Main d'œuvre" />
              {mo.map(l => {
                const idx = globalIndex++;
                return <DataRow key={l.ref + idx} ligne={l} index={idx} />;
              })}
            </>
          )}
          {fo.length > 0 && (
            <>
              <SectionRow label="Fournitures" />
              {fo.map(l => {
                const idx = globalIndex++;
                return <DataRow key={l.ref + idx} ligne={l} index={idx} />;
              })}
            </>
          )}
        </>
      ) : (
        mix.map((l, i) => <DataRow key={l.ref + i} ligne={l} index={i} />)
      )}
    </View>
  );
}

/** Ligne de total */
function TotRow({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <View style={S.totLine}>
      <Text style={large ? S.totLabelLarge : S.totLabel}>{label}</Text>
      <Text style={large ? S.totValueLarge : S.totValue}>{value}</Text>
    </View>
  );
}

// ─── Document principal ──────────────────────────────────────────────────────

export function InvoiceDocument({
  facture,
  client,
  entreprise,
}: InvoiceTemplateProps) {
  // ── Titre selon type Dolibarr ──
  const titre =
    facture.type === 3 ? "FACTURE D'ACOMPTE"
    : facture.type === 2 ? 'AVOIR'
    : facture.type === 5 ? 'FACTURE DE SITUATION'
    : 'FACTURE';

  const isAcompte = facture.type === 3;
  const isPaye    = facture.paye;

  // ── Montant et libellé principal ──
  const montant = isAcompte
    ? Math.round(facture.montantTTC * 0.30 * 100) / 100
    : !isPaye && facture.resteAPayer > 0
      ? facture.resteAPayer
      : facture.montantTTC;

  const labelMontant = isAcompte
    ? 'ACOMPTE À PAYER'
    : isPaye
      ? 'TOTAL TTC — PAYÉE'
      : facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC
        ? 'RESTE À PAYER'
        : 'NET À PAYER';

  // ── TVA par taux ──
  const tvaMap: Record<string, number> = {};
  facture.lignes.forEach(l => {
    if (l.tauxTVA > 0) {
      const k = `${l.tauxTVA}`;
      tvaMap[k] = (tvaMap[k] || 0) + l.totalHT * l.tauxTVA / 100;
    }
  });
  const tvaTotal = Object.values(tvaMap).reduce((a, b) => a + b, 0)
    || (facture.montantTTC - facture.montantHT);

  // ── Infos client ──
  const clientNom = txt(client?.nom || facture.client);
  const clientAdresse = [
    client?.adresse,
    client?.codePostal || client?.ville
      ? `${client?.codePostal ?? ''} ${client?.ville ?? ''}`.trim()
      : '',
    client?.email,
    client?.telephone,
  ].filter(Boolean);

  // ── Infos entreprise ──
  const ent = entreprise ?? {};
  const entNom  = (ent.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase();
  const entInfos = [
    'Au capital de 1 000 €',
    [ent.adresse || '99 Route du Chatelet', ent.codePostal || '74800', ent.ville || 'Cornier'].filter(Boolean).join(' '),
    `SIRET : ${ent.siret || '940 874 936 00013'} – RCS Annecy`,
    ent.email    || 'contact@electriciendugenevois.fr',
    ent.telephone || '06 02 04 42 02',
  ];

  // ── IBAN / BIC ──
  const iban = ent.iban || 'FR76 1695 8000 0179 9683 5713 173';
  const bic  = ent.bic  || 'QNTOFRP1XXX';

  // ── Date échéance ──
  const echeanceStr = (facture as any).echeance
    ? dateFR((facture as any).echeance)
    : 'À réception';

  return (
    <Document title={`${titre} ${facture.ref}`} author={entNom}>
      <Page size="A4" style={S.page}>

        {/* ── LOGO ─────────────────────────────────── */}
        <Image src={logoSrc} style={S.logo} />

        {/* ── TITRE ────────────────────────────────── */}
        <Text style={S.titre}>{titre}</Text>
        <Text style={S.refLine}>NUMÉRO : {txt(facture.ref)}</Text>

        {/* ── BARRE INFO ───────────────────────────── */}
        <View style={S.infoBar}>
          <View style={S.infoCell}>
            <Text style={S.infoLabel}>Référence</Text>
            <Text style={S.infoValue}>{txt(facture.ref)}</Text>
          </View>
          <View style={S.infoCell}>
            <Text style={S.infoLabel}>Date de facture</Text>
            <Text style={S.infoValue}>{dateFR(facture.date)}</Text>
          </View>
          <View style={S.infoCellLast}>
            <Text style={S.infoLabel}>Échéance</Text>
            <Text style={S.infoValue}>{echeanceStr}</Text>
          </View>
        </View>

        {/* ── PARTIES ──────────────────────────────── */}
        <View style={S.parties}>
          {/* Client */}
          <View style={S.partyLeft}>
            <Text style={S.partyLabel}>Facturé à</Text>
            <Text style={S.partyName}>{clientNom}</Text>
            {clientAdresse.map((line, i) => (
              <Text key={i} style={S.partyInfo}>{line}</Text>
            ))}
          </View>
          {/* Entreprise */}
          <View style={S.partyRight}>
            <Text style={S.partyLabel}>Émis par</Text>
            <Text style={S.partyName}>{entNom}</Text>
            {entInfos.map((line, i) => (
              <Text key={i} style={S.partyInfo}>{line}</Text>
            ))}
          </View>
        </View>

        {/* ── TABLEAU ──────────────────────────────── */}
        <LignesTable lignes={facture.lignes} />

        {/* ── SÉPARATEUR MINCE ─────────────────────── */}
        <View style={[S.sepThin, { marginTop: 3 }]} />

        {/* ── DATE + TOTAUX ─────────────────────────── */}
        <View style={S.bottomRow}>
          {/* Gauche : date et note */}
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={S.dateNote}>
              Date de la facture : {dateFR(facture.date)}
            </Text>
            {isAcompte && (
              <Text style={S.dateNote}>
                La présente facture correspond à un acompte de 30 %.
              </Text>
            )}
          </View>
          {/* Droite : totaux */}
          <View style={S.totauxBlock}>
            <TotRow label="TOTAL HT :" value={`${fmt(facture.montantHT)} €`} />
            {Object.keys(tvaMap).length > 0
              ? Object.entries(tvaMap).map(([taux, montantTva]) => (
                  <TotRow
                    key={taux}
                    label={`TVA ${taux} % :`}
                    value={`${fmt(montantTva)} €`}
                  />
                ))
              : <TotRow label="TVA :" value={`${fmt(tvaTotal)} €`} />
            }
            <TotRow
              label="TOTAL TTC :"
              value={`${fmt(facture.montantTTC)} €`}
              large
            />
          </View>
        </View>

        {/* ── SÉPARATEUR ÉPAIS ──────────────────────── */}
        <View style={S.sepBold} />

        {/* ── MONTANT PRINCIPAL ─────────────────────── */}
        <View style={S.montantBlock}>
          <Text style={S.montantLabel}>
            {labelMontant} : {fmt(montant)} €
          </Text>
          {/* Détail si paiement partiel */}
          {!isPaye && facture.resteAPayer > 0
            && facture.resteAPayer < facture.montantTTC
            && !isAcompte && (
            <Text style={[S.dateNote, { marginTop: 2 }]}>
              Total TTC : {fmt(facture.montantTTC)} €  |  Déjà réglé : {fmt(facture.montantTTC - facture.resteAPayer)} €
            </Text>
          )}
        </View>

        {/* ── SÉPARATEUR MINCE ──────────────────────── */}
        <View style={S.sepThin} />

        {/* ── RIB ───────────────────────────────────── */}
        <View style={S.ribBlock}>
          <Text style={S.ribTitre}>Moyens de paiement :</Text>
          <Text style={S.ribData}>IBAN : {iban}</Text>
          <Text style={S.ribData}>BIC  : {bic}</Text>
        </View>

        {/* ── FOOTER LÉGAL ──────────────────────────── */}
        <View style={S.footer}>
          <Text>
            Tout retard de paiement entraînera des pénalités de 10 % par an et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).
          </Text>
          <Text>
            Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO – Contrat n° 24015161184.
          </Text>
          <Text>
            Les matériaux et équipements restent la propriété de l'entreprise jusqu'au paiement intégral de la facture (art. 2367 du Code civil).
          </Text>
        </View>

      </Page>
    </Document>
  );
}
