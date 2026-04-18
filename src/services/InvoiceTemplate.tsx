/**
 * InvoiceTemplate.tsx — Facture PDF via @react-pdf/renderer
 * Design basé sur la référence EDG-FACTURE-ACCOMPTE-PCMG-V33
 */
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Facture, DevisLigne, Client } from '@/services/dolibarr';

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
  /** Data URL du logo (base64) — chargé dans invoiceRenderer avant rendu */
  logoDataUrl?: string;
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
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function safe(v: string | null | undefined): string {
  return v ?? '';
}

// ─── Palette ────────────────────────────────────────────────────────────────

const NOIR   = '#1a1a1a';
const BLANC  = '#ffffff';
const GRIS_L = '#f4f4f4';
const GRIS_T = '#555555';
const GRIS_B = '#cccccc';

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
  logo: { width: 60, height: 20, objectFit: 'contain', marginBottom: 7 },

  // ── Titre ──
  titre: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 22,
    color: NOIR,
    marginBottom: 2,
    lineHeight: 1,
  },
  refLine: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8,
    color: GRIS_T,
    marginBottom: 8,
  },

  // ── Barre info (fond noir) ──
  infoBar: {
    flexDirection: 'row',
    backgroundColor: NOIR,
    marginBottom: 8,
  },
  infoCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRight: '0.5pt solid #444444',
  },
  infoCellLast: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  infoLabel: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#999999',
    marginBottom: 1.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: BLANC,
  },

  // ── Parties (client / entreprise) ──
  parties: { flexDirection: 'row', marginBottom: 8 },
  partyLeft:  { flex: 1, paddingRight: 8 },
  partyRight: { flex: 1, paddingLeft: 8 },
  partyLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: GRIS_T,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  partyName: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9.5,
    color: NOIR,
    marginBottom: 2,
  },
  partyLine: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#333333',
    lineHeight: 1.6,
  },

  // ── Tableau — En-tête ──
  tableHeader: {
    flexDirection: 'row',
    borderTop: '1.5pt solid #1a1a1a',
    borderBottom: '1.5pt solid #1a1a1a',
    paddingVertical: 3,
  },
  thDesc:  { width: '43%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2 },
  thRef:   { width: '10%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, textAlign: 'center' },
  thQte:   { width: '7%',  fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, textAlign: 'center' },
  thUnit:  { width: '8%',  fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, textAlign: 'center' },
  thPrix:  { width: '16%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, textAlign: 'right' },
  thMont:  { width: '16%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, textAlign: 'right' },

  // ── Tableau — Section ──
  sectionRow: { paddingVertical: 3, paddingHorizontal: 2 },
  sectionText: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 8.5,
    color: NOIR,
  },

  // ── Tableau — Ligne données ──
  dataRow: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #dddddd',
    minHeight: 14,
    paddingVertical: 2,
  },
  dataRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #dddddd',
    backgroundColor: GRIS_L,
    minHeight: 14,
    paddingVertical: 2,
  },
  tdDesc:  { width: '43%', fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingTop: 1 },
  tdRef:   { width: '10%', fontFamily: 'Helvetica', fontSize: 7.5, paddingHorizontal: 2, paddingTop: 1, textAlign: 'center', color: GRIS_T },
  tdQte:   { width: '7%',  fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingTop: 1, textAlign: 'center' },
  tdUnit:  { width: '8%',  fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingTop: 1, textAlign: 'center' },
  tdPrix:  { width: '16%', fontFamily: 'Helvetica', fontSize: 8, paddingHorizontal: 2, paddingTop: 1, textAlign: 'right' },
  tdMont:  { width: '16%', fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 2, paddingTop: 1, textAlign: 'right' },

  // ── Séparateurs ──
  sepThin: { borderBottom: '0.5pt solid #cccccc', marginVertical: 4 },
  sepBold: { borderBottom: '1.5pt solid #1a1a1a', marginTop: 4, marginBottom: 0 },

  // ── Totaux ──
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  dateNote: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7.5,
    color: GRIS_T,
    lineHeight: 1.7,
    flex: 1,
    paddingRight: 10,
  },
  totauxBlock: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  totLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  totLabel: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
    color: GRIS_T,
    textAlign: 'right',
    marginRight: 6,
  },
  totValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: NOIR,
    textAlign: 'right',
    minWidth: 30,
  },
  totLabelLarge: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9.5,
    color: NOIR,
    textAlign: 'right',
    marginRight: 6,
    marginTop: 2,
  },
  totValueLarge: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: NOIR,
    textAlign: 'right',
    minWidth: 30,
    marginTop: 2,
  },

  // ── Montant principal ──
  montantBlock: { paddingTop: 8, paddingBottom: 6 },
  montantText: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 20,
    color: NOIR,
    lineHeight: 1.2,
  },
  montantSub: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7.5,
    color: GRIS_T,
    marginTop: 2,
  },

  // ── RIB ──
  ribBlock: { marginTop: 4, marginBottom: 4 },
  ribTitre: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: NOIR, marginBottom: 2 },
  ribLine:  { fontFamily: 'Courier', fontSize: 8, color: '#333333', lineHeight: 1.7 },

  // ── Footer ──
  footer: {
    marginTop: 'auto',
    paddingTop: 4,
    borderTop: '0.5pt solid #cccccc',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 6.5,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 1.75,
  },
});

// ─── Sous-composants ─────────────────────────────────────────────────────────

function DataRow({ ligne, index }: { ligne: DevisLigne; index: number }) {
  const row = index % 2 === 1 ? S.dataRowAlt : S.dataRow;
  return (
    <View style={row} wrap={false}>
      <Text style={S.tdDesc}>{safe(ligne.designation)}</Text>
      <Text style={S.tdRef}>{safe(ligne.ref)}</Text>
      <Text style={S.tdQte}>{String(ligne.quantite ?? '')}</Text>
      <Text style={S.tdUnit}>{ligne.unite || 'U'}</Text>
      <Text style={S.tdPrix}>{fmt(ligne.prixUnitaire)} €</Text>
      <Text style={S.tdMont}>{fmt(ligne.totalHT)} €</Text>
    </View>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <View style={S.sectionRow}>
      <Text style={S.sectionText}>{label}</Text>
    </View>
  );
}

function LignesTable({ lignes }: { lignes: DevisLigne[] }) {
  const mo  = lignes.filter(l => l.productType === 'main_oeuvre');
  const fo  = lignes.filter(l => l.productType === 'fourniture');
  const all = mo.length === 0 && fo.length === 0 ? lignes : [];

  let idx = 0;

  return (
    <View>
      <View style={S.tableHeader}>
        <Text style={S.thDesc}>Description</Text>
        <Text style={S.thRef}>Réf</Text>
        <Text style={S.thQte}>Qté</Text>
        <Text style={S.thUnit}>Unité</Text>
        <Text style={S.thPrix}>Prix unitaire</Text>
        <Text style={S.thMont}>Montant HT</Text>
      </View>

      {mo.length > 0 && (
        <>
          <SectionRow label="Main d'œuvre" />
          {mo.map(l => <DataRow key={`mo-${idx}`} ligne={l} index={idx++} />)}
        </>
      )}
      {fo.length > 0 && (
        <>
          <SectionRow label="Fournitures" />
          {fo.map(l => <DataRow key={`fo-${idx}`} ligne={l} index={idx++} />)}
        </>
      )}
      {all.map(l => <DataRow key={`all-${idx}`} ligne={l} index={idx++} />)}
    </View>
  );
}

function TotRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <View style={S.totLine}>
      <Text style={large ? S.totLabelLarge : S.totLabel}>{label}</Text>
      <Text style={large ? S.totValueLarge : S.totValue}>{value}</Text>
    </View>
  );
}

// ─── Document principal ──────────────────────────────────────────────────────

export function InvoiceDocument({ facture, client, entreprise, logoDataUrl }: InvoiceTemplateProps) {

  // ── Type / titre ──
  const isAcompte = facture.type === 3;
  const isAvoir   = facture.type === 2;
  const isSituation = facture.type === 5;
  const titre = isAcompte ? "FACTURE D'ACOMPTE"
    : isAvoir ? 'AVOIR'
    : isSituation ? 'FACTURE DE SITUATION'
    : 'FACTURE';

  // ── Montant affiché ──
  const montantAffiche = isAcompte
    ? Math.round(facture.montantTTC * 0.30 * 100) / 100
    : !facture.paye && facture.resteAPayer > 0
      ? facture.resteAPayer
      : facture.montantTTC;

  const labelMontant = isAcompte ? 'ACOMPTE À PAYER'
    : facture.paye ? 'TOTAL TTC — PAYÉE'
    : facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC ? 'RESTE À PAYER'
    : 'NET À PAYER';

  // ── TVA par taux ──
  const tvaMap: Record<string, number> = {};
  (facture.lignes || []).forEach(l => {
    if (l.tauxTVA > 0) {
      const k = `${l.tauxTVA}`;
      tvaMap[k] = (tvaMap[k] || 0) + l.totalHT * l.tauxTVA / 100;
    }
  });
  const tvaFallback = facture.montantTTC - facture.montantHT;

  // ── Client ──
  const clientNom   = safe(client?.nom || facture.client);
  const clientLines = [
    client?.adresse,
    client?.codePostal || client?.ville
      ? `${client?.codePostal ?? ''} ${client?.ville ?? ''}`.trim()
      : undefined,
    client?.email,
    client?.telephone,
  ].filter((l): l is string => !!l);

  // ── Entreprise ──
  const ent = entreprise ?? {};
  const entNom = (ent.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase();
  const entAdresse = [ent.adresse || '99 Route du Chatelet', ent.codePostal || '74800', ent.ville || 'Cornier'].filter(Boolean).join(' ');
  const entLines = [
    'Au capital de 1 000 €',
    entAdresse,
    `SIRET : ${ent.siret || '940 874 936 00013'} – RCS Annecy`,
    ent.email    || 'contact@electriciendugenevois.fr',
    ent.telephone || '06 02 04 42 02',
  ];

  const iban = ent.iban || 'FR76 1695 8000 0179 9683 5713 173';
  const bic  = ent.bic  || 'QNTOFRP1XXX';

  const echeanceStr = (facture as any).echeance ? dateFR((facture as any).echeance) : 'À réception';

  return (
    <Document title={`${titre} ${facture.ref}`} author={entNom}>
      <Page size="A4" style={S.page}>

        {/* ── LOGO ─────────────────────────── */}
        {logoDataUrl ? (
          <Image src={logoDataUrl} style={S.logo} />
        ) : (
          <View style={{ height: 20, marginBottom: 7 }} />
        )}

        {/* ── TITRE ────────────────────────── */}
        <Text style={S.titre}>{titre}</Text>
        <Text style={S.refLine}>NUMÉRO : {safe(facture.ref)}</Text>

        {/* ── BARRE INFO ───────────────────── */}
        <View style={S.infoBar}>
          <View style={S.infoCell}>
            <Text style={S.infoLabel}>Référence</Text>
            <Text style={S.infoValue}>{safe(facture.ref)}</Text>
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

        {/* ── PARTIES ──────────────────────── */}
        <View style={S.parties}>
          <View style={S.partyLeft}>
            <Text style={S.partyLabel}>Facturé à</Text>
            <Text style={S.partyName}>{clientNom}</Text>
            {clientLines.map((line, i) => (
              <Text key={i} style={S.partyLine}>{line}</Text>
            ))}
          </View>
          <View style={S.partyRight}>
            <Text style={S.partyLabel}>Émis par</Text>
            <Text style={S.partyName}>{entNom}</Text>
            {entLines.map((line, i) => (
              <Text key={i} style={S.partyLine}>{line}</Text>
            ))}
          </View>
        </View>

        {/* ── TABLEAU ──────────────────────── */}
        <LignesTable lignes={facture.lignes || []} />

        {/* ── SÉPARATEUR MINCE ─────────────── */}
        <View style={S.sepThin} />

        {/* ── DATE + TOTAUX ────────────────── */}
        <View style={S.bottomRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={S.dateNote}>Date de la facture : {dateFR(facture.date)}</Text>
            {isAcompte && (
              <Text style={S.dateNote}>La présente facture correspond à un acompte de 30 %.</Text>
            )}
          </View>
          <View style={S.totauxBlock}>
            <TotRow label="TOTAL HT :" value={`${fmt(facture.montantHT)} €`} />
            {Object.keys(tvaMap).length > 0
              ? Object.entries(tvaMap).map(([taux, montantTva]) => (
                  <TotRow key={taux} label={`TVA ${taux} % :`} value={`${fmt(montantTva)} €`} />
                ))
              : <TotRow label="TVA :" value={`${fmt(tvaFallback)} €`} />
            }
            <TotRow label="TOTAL TTC :" value={`${fmt(facture.montantTTC)} €`} large />
          </View>
        </View>

        {/* ── SÉPARATEUR ÉPAIS ─────────────── */}
        <View style={S.sepBold} />

        {/* ── MONTANT PRINCIPAL ────────────── */}
        <View style={S.montantBlock}>
          <Text style={S.montantText}>{labelMontant} : {fmt(montantAffiche)} €</Text>
          {!facture.paye && facture.resteAPayer > 0
            && facture.resteAPayer < facture.montantTTC && !isAcompte && (
            <Text style={S.montantSub}>
              Total TTC : {fmt(facture.montantTTC)} €  |  Déjà réglé : {fmt(facture.montantTTC - facture.resteAPayer)} €
            </Text>
          )}
        </View>

        {/* ── SÉPARATEUR MINCE ─────────────── */}
        <View style={S.sepThin} />

        {/* ── RIB ──────────────────────────── */}
        <View style={S.ribBlock}>
          <Text style={S.ribTitre}>Moyens de paiement :</Text>
          <Text style={S.ribLine}>IBAN : {iban}</Text>
          <Text style={S.ribLine}>BIC  : {bic}</Text>
        </View>

        {/* ── FOOTER LÉGAL ─────────────────── */}
        <View style={S.footer}>
          <Text>Tout retard de paiement entraînera des pénalités de 10 % par an et une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).</Text>
          <Text>Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO – Contrat n° 24015161184.</Text>
          <Text>Les matériaux et équipements restent la propriété de l'entreprise jusqu'au paiement intégral de la facture (art. 2367 du Code civil).</Text>
        </View>

      </Page>
    </Document>
  );
}
