/**
 * SharedPdfTemplate.tsx — Template PDF unifié @react-pdf/renderer
 * Design unique pour Devis, Bon d'intervention et Facture.
 * Les couleurs, marges, logo, RIB et footer proviennent du templateCfg.
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
import type { Devis, DevisLigne, Facture, Client, Intervention, InterventionLine } from '@/services/dolibarr';

// ─── Enregistrement des polices ───────────────────────────────────────────────

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.2.10/files/roboto-latin-400-normal.woff2' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.2.10/files/roboto-latin-700-normal.woff2', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.2.10/files/roboto-latin-400-italic.woff2', fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.2.10/files/roboto-latin-700-italic.woff2', fontWeight: 700, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.2.8/files/montserrat-latin-400-normal.woff2' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.2.8/files/montserrat-latin-700-normal.woff2', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.2.8/files/montserrat-latin-400-italic.woff2', fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.2.8/files/montserrat-latin-700-italic.woff2', fontWeight: 700, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.8/files/inter-latin-400-normal.woff2' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.8/files/inter-latin-700-normal.woff2', fontWeight: 700 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.8/files/inter-latin-400-italic.woff2', fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.8/files/inter-latin-700-italic.woff2', fontWeight: 700, fontStyle: 'italic' },
  ],
});

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface TemplateCfg {
  logoUrl?: string;
  couleurPrimaire?: string;
  couleurAccent?: string;
  couleurTexte?: string;
  police?: 'helvetica' | 'times' | 'courier' | 'roboto' | 'montserrat' | 'inter';
  margeHaut?: number;
  margeBas?: number;
  margeGauche?: number;
  margeDroite?: number;
  tailleTitre?: number;
  tailleTexte?: number;
  piedDePage?: string;
  afficherRib?: boolean;
  afficherCgv?: boolean;
}

export interface DevisDocParams {
  type: 'devis';
  devis: Devis;
  client?: Client;
  entreprise?: EntrepriseInfo;
  logoDataUrl?: string;
  templateCfg?: TemplateCfg;
}

export interface FactureDocParams {
  type: 'facture';
  facture: Facture;
  client?: Client;
  entreprise?: EntrepriseInfo;
  logoDataUrl?: string;
  templateCfg?: TemplateCfg;
}

export interface InterventionDocParams {
  type: 'intervention';
  intervention: Intervention;
  lines: InterventionLine[];
  client?: Client;
  entreprise?: EntrepriseInfo;
  logoDataUrl?: string;
  templateCfg?: TemplateCfg;
  signatureClient?: string;
  signatureTech?: string;
}

export type SharedDocParams = DevisDocParams | FactureDocParams | InterventionDocParams;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function safe(v: unknown): string {
  return v == null ? '' : String(v);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  devis:         'Établissement devis',
  panne:         'Dépannage',
  panne_urgence: 'Urgence',
  sav:           'SAV / Garantie',
  chantier:      'Chantier',
};

// ─── Résolution des polices ───────────────────────────────────────────────────

type FontSet = {
  reg:    { fontFamily: string };
  bold:   { fontFamily: string; fontWeight?: number };
  italic: { fontFamily: string; fontStyle?: string };
  bi:     { fontFamily: string; fontWeight?: number; fontStyle?: string };
};

function resolveFont(police?: string): FontSet {
  switch (police) {
    case 'roboto':
    case 'montserrat':
    case 'inter': {
      const fam = police === 'roboto' ? 'Roboto' : police === 'montserrat' ? 'Montserrat' : 'Inter';
      return {
        reg:    { fontFamily: fam },
        bold:   { fontFamily: fam, fontWeight: 700 },
        italic: { fontFamily: fam, fontStyle: 'italic' },
        bi:     { fontFamily: fam, fontWeight: 700, fontStyle: 'italic' },
      };
    }
    case 'times':
      return {
        reg:    { fontFamily: 'Times-Roman' },
        bold:   { fontFamily: 'Times-Bold' },
        italic: { fontFamily: 'Times-Italic' },
        bi:     { fontFamily: 'Times-BoldItalic' },
      };
    case 'courier':
      return {
        reg:    { fontFamily: 'Courier' },
        bold:   { fontFamily: 'Courier-Bold' },
        italic: { fontFamily: 'Courier-Oblique' },
        bi:     { fontFamily: 'Courier-BoldOblique' },
      };
    default:
      return {
        reg:    { fontFamily: 'Helvetica' },
        bold:   { fontFamily: 'Helvetica-Bold' },
        italic: { fontFamily: 'Helvetica-Oblique' },
        bi:     { fontFamily: 'Helvetica-BoldOblique' },
      };
  }
}

// ─── StyleSheet dynamique ─────────────────────────────────────────────────────

function makeStyles(cfg: TemplateCfg) {
  const NOIR   = cfg.couleurPrimaire || '#1a1a1a';
  const ACCENT = cfg.couleurAccent   || '#cc0000';
  const BLANC  = '#ffffff';
  const GRIS_L = '#f7f7f7';
  const GRIS_T = '#555555';
  const GRIS_B = '#e0e0e0';
  const GRIS_P = '#777777';

  const MT = cfg.margeHaut   ?? 18;
  const MB = cfg.margeBas    ?? 20;
  const ML = cfg.margeGauche ?? 15;
  const MR = cfg.margeDroite ?? 15;

  const TITRE_SIZE = cfg.tailleTitre ?? 22;
  const TEXT_SIZE  = cfg.tailleTexte ?? 9;
  const F = resolveFont(cfg.police);

  return StyleSheet.create({
    page: {
      ...F.reg,
      fontSize: TEXT_SIZE,
      color: NOIR,
      backgroundColor: BLANC,
      paddingTop: MT,
      paddingBottom: MB,
      paddingLeft: ML,
      paddingRight: MR,
      flexDirection: 'column',
    },

    // ── Logo ──
    logo: { height: 38, maxWidth: 130, objectFit: 'contain', marginBottom: 14 },

    // ── Titre ──
    titre: {
      ...F.bi,
      fontSize: TITRE_SIZE,
      color: NOIR,
      lineHeight: 1.1,
    },
    refLine: {
      ...F.italic,
      fontSize: 8,
      color: GRIS_T,
      marginTop: 2,
      marginBottom: 14,
    },

    // ── Barre info (fond couleurPrimaire) ──
    infoBar: {
      flexDirection: 'row',
      backgroundColor: NOIR,
      marginBottom: 14,
      borderRadius: 2,
    },
    infoCell: {
      flex: 1,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRight: '0.5pt solid rgba(255,255,255,0.2)',
    },
    infoCellLast: {
      flex: 1,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    infoLabel: {
      ...F.reg,
      fontSize: 6.5,
      color: '#bbbbbb',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    infoValue: {
      ...F.bold,
      fontSize: 8.5,
      color: BLANC,
    },

    // ── Parties (client / entreprise) ──
    parties: { flexDirection: 'row', marginBottom: 14, gap: 16 },
    partyLeft:  { flex: 1 },
    partyRight: { flex: 1 },
    partyName: {
      ...F.bi,
      fontSize: 9.5,
      color: NOIR,
      marginBottom: 3,
    },
    partyLine: {
      ...F.reg,
      fontSize: 8.5,
      color: '#333333',
      lineHeight: 1.5,
    },

    // ── Tableau — En-tête ──
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: NOIR,
      color: BLANC,
      paddingVertical: 4,
    },
    thDesc:  { width: '40%', ...F.bold, fontSize: 8, paddingHorizontal: 4, color: BLANC },
    thRef:   { width: '10%', ...F.bold, fontSize: 8, paddingHorizontal: 2, textAlign: 'center', color: BLANC },
    thQte:   { width: '8%',  ...F.bold, fontSize: 8, paddingHorizontal: 2, textAlign: 'center', color: BLANC },
    thUnit:  { width: '8%',  ...F.bold, fontSize: 8, paddingHorizontal: 2, textAlign: 'center', color: BLANC },
    thPrix:  { width: '17%', ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'right', color: BLANC },
    thTva:   { width: '7%',  ...F.bold, fontSize: 8, paddingHorizontal: 2, textAlign: 'center', color: BLANC },
    thMont:  { width: '10%', ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'right', color: BLANC },

    // ── Tableau — Section ──
    sectionRow: { paddingVertical: 3, paddingHorizontal: 4, backgroundColor: '#f0f0f0' },
    sectionText: {
      ...F.bi,
      fontSize: 8.5,
      color: NOIR,
    },

    // ── Tableau — Ligne données ──
    dataRow: {
      flexDirection: 'row',
      borderBottom: `0.3pt solid ${GRIS_B}`,
      minHeight: 16,
      paddingVertical: 2,
    },
    dataRowAlt: {
      flexDirection: 'row',
      borderBottom: `0.3pt solid ${GRIS_B}`,
      backgroundColor: GRIS_L,
      minHeight: 16,
      paddingVertical: 2,
    },
    tdDesc:  { width: '40%', ...F.reg, fontSize: 8, paddingHorizontal: 4, paddingTop: 2 },
    tdRef:   { width: '10%', ...F.reg, fontSize: 7.5, paddingHorizontal: 2, paddingTop: 2, textAlign: 'center', color: GRIS_T },
    tdQte:   { width: '8%',  ...F.reg, fontSize: 8, paddingHorizontal: 2, paddingTop: 2, textAlign: 'center' },
    tdUnit:  { width: '8%',  ...F.reg, fontSize: 8, paddingHorizontal: 2, paddingTop: 2, textAlign: 'center' },
    tdPrix:  { width: '17%', ...F.reg, fontSize: 8, paddingHorizontal: 4, paddingTop: 2, textAlign: 'right' },
    tdTva:   { width: '7%',  ...F.reg, fontSize: 8, paddingHorizontal: 2, paddingTop: 2, textAlign: 'center', color: GRIS_T },
    tdMont:  { width: '10%', ...F.bold, fontSize: 8, paddingHorizontal: 4, paddingTop: 2, textAlign: 'right' },

    // ── Tableau intervention ──
    intHeader: {
      flexDirection: 'row',
      backgroundColor: NOIR,
      paddingVertical: 4,
    },
    intThNo:   { width: '8%',  ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'center', color: BLANC },
    intThDesc: { width: '58%', ...F.bold, fontSize: 8, paddingHorizontal: 4, color: BLANC },
    intThDate: { width: '20%', ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'center', color: BLANC },
    intThDur:  { width: '14%', ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'center', color: BLANC },

    intRow: {
      flexDirection: 'row',
      borderBottom: `0.3pt solid ${GRIS_B}`,
      minHeight: 16,
      paddingVertical: 2,
    },
    intRowAlt: {
      flexDirection: 'row',
      borderBottom: `0.3pt solid ${GRIS_B}`,
      backgroundColor: GRIS_L,
      minHeight: 16,
      paddingVertical: 2,
    },
    intTdNo:   { width: '8%',  ...F.reg, fontSize: 8, paddingHorizontal: 4, paddingTop: 2, textAlign: 'center', color: GRIS_T },
    intTdDesc: { width: '58%', ...F.reg, fontSize: 8, paddingHorizontal: 4, paddingTop: 2 },
    intTdDate: { width: '20%', ...F.reg, fontSize: 8, paddingHorizontal: 4, paddingTop: 2, textAlign: 'center' },
    intTdDur:  { width: '14%', ...F.bold, fontSize: 8, paddingHorizontal: 4, paddingTop: 2, textAlign: 'center' },

    intFootRow: {
      flexDirection: 'row',
      backgroundColor: GRIS_L,
      borderTop: `1pt solid ${NOIR}`,
      paddingVertical: 4,
    },
    intFootLabel: { width: '66%', ...F.bi, fontSize: 8, paddingHorizontal: 4 },
    intFootDur:   { width: '14%', ...F.bold, fontSize: 8, paddingHorizontal: 4, textAlign: 'center' },

    // ── Description intervention ──
    descBlock: { marginBottom: 10 },
    descTitle: {
      ...F.bi,
      fontSize: 9.5,
      color: NOIR,
      marginBottom: 4,
    },
    descText: {
      ...F.reg,
      fontSize: 8.5,
      color: '#222222',
      lineHeight: 1.5,
    },

    // ── Séparateurs ──
    sepThin: { borderBottom: `0.5pt solid ${GRIS_B}`, marginVertical: 6 },
    sepBold: { borderBottom: `1.5pt solid ${NOIR}`, marginVertical: 4 },

    // ── Totaux ──
    totauxRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
    },
    totauxBlock: { alignItems: 'flex-end', minWidth: 200 },
    totLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    totLabel: {
      ...F.italic,
      fontSize: 9,
      color: GRIS_T,
      textAlign: 'right',
      marginRight: 8,
    },
    totValue: {
      ...F.bold,
      fontSize: 9,
      color: NOIR,
      textAlign: 'right',
      minWidth: 60,
    },
    totLabelLarge: {
      ...F.bi,
      fontSize: 10,
      color: NOIR,
      textAlign: 'right',
      marginRight: 8,
    },
    totValueLarge: {
      ...F.bold,
      fontSize: 10,
      color: NOIR,
      textAlign: 'right',
      minWidth: 60,
    },

    // ── Net à payer ──
    netBlock: { backgroundColor: NOIR, padding: 10, marginTop: 6 },
    netText: {
      ...F.bi,
      fontSize: 14,
      color: BLANC,
      textAlign: 'center',
    },
    netSub: {
      ...F.italic,
      fontSize: 7.5,
      color: '#cccccc',
      textAlign: 'center',
      marginTop: 2,
    },

    // ── Acompte (devis) ──
    acompteBlock: {
      borderWidth: 1.5,
      borderColor: ACCENT,
      backgroundColor: `${ACCENT}15`,
      borderRadius: 3,
      padding: 8,
      marginTop: 8,
      alignItems: 'center',
    },
    acompteText: {
      ...F.bi,
      fontSize: 9,
      color: ACCENT,
    },

    // ── Signatures (intervention) ──
    sigRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    sigBox: {
      flex: 1,
      borderWidth: 0.5,
      borderColor: GRIS_B,
      borderRadius: 2,
      height: 70,
      padding: 6,
    },
    sigLabel: {
      ...F.bi,
      fontSize: 7.5,
      color: GRIS_T,
      marginBottom: 4,
    },
    sigImage: { width: '100%', height: 45, objectFit: 'contain' },

    // ── RIB ──
    ribBlock: { marginTop: 8 },
    ribTitle: { ...F.bold, fontSize: 8.5, color: NOIR, marginBottom: 3 },
    ribLine:  { fontFamily: 'Courier', fontSize: 8, color: '#333333', lineHeight: 1.7 },

    // ── Footer ──
    footer: {
      marginTop: 'auto',
      paddingTop: 5,
      borderTop: `0.5pt solid ${GRIS_B}`,
      ...F.italic,
      fontSize: 6.5,
      color: GRIS_P,
      textAlign: 'center',
      lineHeight: 1.75,
    },
  });
}

type S = ReturnType<typeof makeStyles>;

// ─── Composants partagés ──────────────────────────────────────────────────────

function LogoSection({ logoDataUrl, S }: { logoDataUrl?: string; S: S }) {
  if (!logoDataUrl) return <View style={{ height: 38, marginBottom: 14 }} />;
  return <Image src={logoDataUrl} style={S.logo} />;
}

function InfoBar({ cells, S }: { cells: { label: string; value: string }[]; S: S }) {
  return (
    <View style={S.infoBar}>
      {cells.map((c, i) => (
        <View key={i} style={i < cells.length - 1 ? S.infoCell : S.infoCellLast}>
          <Text style={S.infoLabel}>{c.label.toUpperCase()}</Text>
          <Text style={S.infoValue}>{c.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Parties({ clientNom, clientLines, entNom, entLines, S }: {
  clientNom: string; clientLines: string[];
  entNom: string; entLines: string[];
  S: S;
}) {
  return (
    <View style={S.parties}>
      <View style={S.partyLeft}>
        <Text style={S.partyName}>{clientNom}</Text>
        {clientLines.map((l, i) => <Text key={i} style={S.partyLine}>{l}</Text>)}
      </View>
      <View style={S.partyRight}>
        <Text style={S.partyName}>{entNom}</Text>
        {entLines.map((l, i) => <Text key={i} style={S.partyLine}>{l}</Text>)}
      </View>
    </View>
  );
}

function LignesTable({ lignes, S }: { lignes: DevisLigne[]; S: S }) {
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
        <Text style={S.thTva}>TVA</Text>
        <Text style={S.thMont}>Montant</Text>
      </View>

      {mo.length > 0 && (
        <>
          <View style={S.sectionRow}><Text style={S.sectionText}>Main d'œuvre</Text></View>
          {mo.map(l => <LigneRow key={`mo-${idx}`} ligne={l} index={idx++} S={S} />)}
        </>
      )}
      {fo.length > 0 && (
        <>
          <View style={S.sectionRow}><Text style={S.sectionText}>Fournitures</Text></View>
          {fo.map(l => <LigneRow key={`fo-${idx}`} ligne={l} index={idx++} S={S} />)}
        </>
      )}
      {all.map(l => <LigneRow key={`all-${idx}`} ligne={l} index={idx++} S={S} />)}
    </View>
  );
}

function LigneRow({ ligne, index, S }: { ligne: DevisLigne; index: number; S: S }) {
  const style = index % 2 === 1 ? S.dataRowAlt : S.dataRow;
  return (
    <View style={style} wrap={false}>
      <Text style={S.tdDesc}>{safe(ligne.designation)}</Text>
      <Text style={S.tdRef}>{safe(ligne.ref)}</Text>
      <Text style={S.tdQte}>{safe(ligne.quantite)}</Text>
      <Text style={S.tdUnit}>{ligne.unite || 'U'}</Text>
      <Text style={S.tdPrix}>{fmt(ligne.prixUnitaire)} €</Text>
      <Text style={S.tdTva}>{ligne.tauxTVA}%</Text>
      <Text style={S.tdMont}>{fmt(ligne.totalHT)} €</Text>
    </View>
  );
}

function Totaux({ rows, S }: { rows: { label: string; value: string; large?: boolean }[]; S: S }) {
  return (
    <View style={S.totauxRow}>
      <View style={S.totauxBlock}>
        {rows.map((r, i) => (
          <View key={i} style={S.totLine}>
            <Text style={r.large ? S.totLabelLarge : S.totLabel}>{r.label}</Text>
            <Text style={r.large ? S.totValueLarge : S.totValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RibSection({ iban, bic, S }: { iban: string; bic: string; S: S }) {
  return (
    <View style={S.ribBlock}>
      <Text style={S.ribTitle}>Moyens de paiement :</Text>
      <Text style={S.ribLine}>IBAN : {iban}</Text>
      <Text style={S.ribLine}>BIC  : {bic}</Text>
    </View>
  );
}

function FooterSection({ text, S }: { text: string | null; S: S }) {
  return (
    <View style={S.footer}>
      {text ? (
        <Text>{text}</Text>
      ) : (
        <>
          <Text>Nos travaux sont couverts par notre assurance décennale et RC Pro auprès d'ERGO — Contrat n° 24015161184.</Text>
          <Text>Tout retard de paiement entraînera des pénalités de 10 % par an et une indemnité forfaitaire de 40 € (art. L441-10 C. com.).</Text>
          <Text>Les matériaux et équipements restent la propriété de l'entreprise jusqu'au paiement intégral (art. 2367 C. civ.).</Text>
        </>
      )}
    </View>
  );
}

// ─── Fonction utilitaire : infos entreprise ───────────────────────────────────

function buildEntrepriseLines(ent: EntrepriseInfo) {
  const nom = (ent.nom || 'EURL ELECTRICIEN DU GENEVOIS').toUpperCase();
  const adresse = [ent.adresse || '99 Route du Chatelet', ent.codePostal || '74800', ent.ville || 'Cornier'].filter(Boolean).join(' ');
  const lines = [
    adresse,
    `SIRET : ${ent.siret || '940 874 936 00013'} — RCS Annecy`,
    ent.email    || 'contact@electriciendugenevois.fr',
    ent.telephone || '06 02 04 42 02',
  ];
  return { nom, lines, iban: ent.iban || 'FR76 1695 8000 0179 9683 5713 173', bic: ent.bic || 'QNTOFRP1XXX' };
}

function buildClientLines(client: Client | undefined, nom: string) {
  const lines: string[] = [];
  if (client?.adresse) lines.push(client.adresse);
  const city = [client?.codePostal, client?.ville].filter(Boolean).join(' ');
  if (city) lines.push(city);
  if (client?.email) lines.push(client.email);
  if (client?.telephone) lines.push(client.telephone);
  return { nom, lines };
}

// ─── CGV page 2 ──────────────────────────────────────────────────────────────

const CGV_ARTICLES = [
  { titre: '1. Objet et acceptation', texte: "Les présentes CGV s'appliquent à toutes les prestations et fournitures réalisées par EURL ELECTRICIEN DU GENEVOIS. Toute commande implique l'acceptation sans réserve de ces CGV." },
  { titre: '2. Devis et commande', texte: "Nos devis sont valables 30 jours. La commande est ferme dès la réception du devis signé avec la mention « bon pour accord » et le versement de l'acompte." },
  { titre: '3. Prix et facturation', texte: "Les prix sont établis en euros hors taxes. Tout travail supplémentaire non prévu au devis initial fera l'objet d'un avenant écrit signé des deux parties." },
  { titre: '4. Modalités de paiement', texte: "Un acompte de 30 % est exigible à la signature du devis (50 % pour les chantiers inférieurs à 5 000 € HT). Le solde est dû à la réception des travaux." },
  { titre: "5. Délais d'exécution", texte: "Les délais d'exécution sont donnés à titre indicatif. L'Entreprise ne saurait être tenue responsable des retards résultant de causes extérieures (intempéries, retards d'approvisionnement, force majeure)." },
  { titre: '6. Réserve de propriété', texte: "Les fournitures et équipements installés restent la propriété de l'Entreprise jusqu'au paiement intégral de la facture (art. 2367 du Code civil)." },
  { titre: '7. Garantie', texte: "L'Entreprise garantit ses travaux pendant un an à compter de la réception. Cette garantie couvre les défauts de pose et de mise en œuvre, à l'exclusion de toute usure normale ou intervention d'un tiers." },
  { titre: '8. Assurance', texte: "L'Entreprise est assurée en responsabilité civile professionnelle et en garantie décennale auprès de la compagnie ERGO — Contrat n° 24015161184." },
  { titre: '9. Résiliation', texte: "En cas d'annulation du chantier par le client après signature du devis, l'acompte versé restera acquis à l'Entreprise à titre d'indemnité forfaitaire." },
  { titre: '10. Litiges', texte: "En cas de différend, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. Le Tribunal d'Annecy sera seul compétent." },
];

function CgvPage({ NOIR, BLANC, cfg }: { NOIR: string; BLANC: string; cfg: TemplateCfg }) {
  const F = resolveFont(cfg.police);
  return (
    <Page size="A4" style={{
      ...F.reg,
      fontSize: 8,
      color: NOIR,
      backgroundColor: BLANC,
      paddingTop: cfg.margeHaut ?? 18,
      paddingBottom: cfg.margeBas ?? 20,
      paddingLeft: cfg.margeGauche ?? 15,
      paddingRight: cfg.margeDroite ?? 15,
    }}>
      <Text style={{ ...F.bi, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
        CONDITIONS GÉNÉRALES DE VENTE
      </Text>
      <View style={{ borderBottom: `1pt solid ${NOIR}`, marginBottom: 10 }} />
      {CGV_ARTICLES.map((a, i) => (
        <View key={i} style={{ marginBottom: 8 }}>
          <Text style={{ ...F.bold, fontSize: 8.5, marginBottom: 2 }}>{a.titre}</Text>
          <Text style={{ ...F.reg, lineHeight: 1.5, color: '#333333' }}>{a.texte}</Text>
        </View>
      ))}
    </Page>
  );
}

// ─── Document DEVIS ───────────────────────────────────────────────────────────

function DevisDocument({ devis, client, entreprise, logoDataUrl, templateCfg }: DevisDocParams) {
  const cfg = templateCfg ?? {};
  const S = makeStyles(cfg);
  const NOIR   = cfg.couleurPrimaire || '#1a1a1a';
  const ACCENT = cfg.couleurAccent   || '#cc0000';
  const BLANC  = '#ffffff';

  const showRib = cfg.afficherRib !== false;
  const showCgv = cfg.afficherCgv !== false;
  const footerText = cfg.piedDePage?.trim() || null;

  const ent = buildEntrepriseLines(entreprise ?? {});
  const cli = buildClientLines(client, safe(client?.nom || devis.client));

  const tvaMap: Record<string, number> = {};
  (devis.lignes || []).forEach(l => {
    if (l.tauxTVA > 0) {
      const k = `${l.tauxTVA}`;
      tvaMap[k] = (tvaMap[k] || 0) + l.totalHT * l.tauxTVA / 100;
    }
  });

  const totRows = [
    { label: 'TOTAL HT :', value: `${fmt(devis.montantHT)} €` },
    ...(Object.keys(tvaMap).length > 0
      ? Object.entries(tvaMap).map(([taux, mt]) => ({ label: `TVA (${taux}%) :`, value: `${fmt(mt)} €` }))
      : [{ label: 'TVA :', value: `${fmt(devis.montantTTC - devis.montantHT)} €` }]),
    { label: 'NET À PAYER :', value: `${fmt(devis.montantTTC)} €`, large: true },
  ];

  const acompte = Math.round(devis.montantTTC * 0.30 * 100) / 100;

  return (
    <Document title={`Devis ${devis.ref}`} author={ent.nom}>
      <Page size="A4" style={S.page}>
        <LogoSection logoDataUrl={logoDataUrl} S={S} />

        <Text style={S.titre}>DEVIS</Text>
        <Text style={S.refLine}>NUMÉRO DE DEVIS : {safe(devis.ref)}</Text>

        <InfoBar cells={[
          { label: 'Référence', value: safe(devis.ref) },
          { label: 'Date',      value: dateFR(devis.date) },
        ]} S={S} />

        <Parties
          clientNom={cli.nom} clientLines={cli.lines}
          entNom={ent.nom} entLines={ent.lines}
          S={S}
        />

        <LignesTable lignes={devis.lignes || []} S={S} />

        <View style={S.sepThin} />

        <Totaux rows={totRows} S={S} />

        {/* Acompte */}
        <View style={S.acompteBlock}>
          <Text style={S.acompteText}>⚠  ACOMPTE 30 % À PAYER À LA SIGNATURE — SOIT {fmt(acompte)} €</Text>
        </View>

        {/* Signature */}
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Signature du client (bon pour accord) :</Text>
          </View>
          <View style={S.netBlock}>
            <Text style={S.netText}>NET À PAYER : {fmt(devis.montantTTC)} €</Text>
            <Text style={S.netSub}>Devis établi le {dateFR(devis.date)}</Text>
          </View>
        </View>

        {showRib && <RibSection iban={ent.iban} bic={ent.bic} S={S} />}
        <FooterSection text={footerText} S={S} />
      </Page>

      {showCgv && <CgvPage NOIR={NOIR} BLANC={BLANC} cfg={cfg} />}
    </Document>
  );
}

// ─── Document BON D'INTERVENTION ─────────────────────────────────────────────

function InterventionDocument({ intervention, lines, client, entreprise, logoDataUrl, templateCfg, signatureClient, signatureTech }: InterventionDocParams) {
  const cfg = templateCfg ?? {};
  const S = makeStyles(cfg);
  const footerText = cfg.piedDePage?.trim() || null;

  const ent = buildEntrepriseLines(entreprise ?? {});
  const cli = buildClientLines(client, safe(client?.nom || intervention.client));

  const typeLabel = INTERVENTION_TYPE_LABELS[intervention.type] || safe(intervention.type);
  const totalDur = lines.reduce((s, l) => s + (l.duree || 0), 0);

  return (
    <Document title={`Bon d'intervention ${intervention.ref}`} author={ent.nom}>
      <Page size="A4" style={S.page}>
        <LogoSection logoDataUrl={logoDataUrl} S={S} />

        <Text style={S.titre}>BON D'INTERVENTION</Text>
        <Text style={S.refLine}>RÉFÉRENCE : {safe(intervention.ref)}</Text>

        <InfoBar cells={[
          { label: 'Référence',  value: safe(intervention.ref) },
          { label: 'Date',       value: dateFR(intervention.date) },
          { label: 'Type',       value: typeLabel },
          { label: 'Technicien', value: safe(intervention.technicien || '—') },
        ]} S={S} />

        <Parties
          clientNom={cli.nom} clientLines={cli.lines}
          entNom={ent.nom} entLines={ent.lines}
          S={S}
        />

        {/* Description */}
        {intervention.description && (
          <View style={S.descBlock}>
            <Text style={S.descTitle}>Description des travaux</Text>
            <View style={{ borderBottom: `0.5pt solid #cccccc`, marginBottom: 5 }} />
            <Text style={S.descText}>{safe(intervention.description)}</Text>
          </View>
        )}

        {/* Lignes d'intervention */}
        {lines && lines.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={S.descTitle}>Lignes d'intervention</Text>
            <View style={{ borderBottom: `0.5pt solid #cccccc`, marginBottom: 4 }} />
            <View style={S.intHeader}>
              <Text style={S.intThNo}>#</Text>
              <Text style={S.intThDesc}>Description</Text>
              <Text style={S.intThDate}>Date</Text>
              <Text style={S.intThDur}>Durée</Text>
            </View>
            {lines.map((l, i) => (
              <View key={i} style={i % 2 === 1 ? S.intRowAlt : S.intRow} wrap={false}>
                <Text style={S.intTdNo}>{i + 1}</Text>
                <Text style={S.intTdDesc}>{safe(l.description)}</Text>
                <Text style={S.intTdDate}>{dateFR(l.date)}</Text>
                <Text style={S.intTdDur}>{formatDuration(l.duree || 0)}</Text>
              </View>
            ))}
            {totalDur > 0 && (
              <View style={S.intFootRow}>
                <Text style={S.intFootLabel}>TOTAL HEURES</Text>
                <Text style={S.intFootDur}>{formatDuration(totalDur)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={S.sepThin} />

        {/* Signatures */}
        <View style={S.sigRow}>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Signature du technicien :</Text>
            {signatureTech && (
              <Image src={signatureTech} style={S.sigImage} />
            )}
          </View>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Signature du client (bon pour accord) :</Text>
            {signatureClient && (
              <Image src={signatureClient} style={S.sigImage} />
            )}
          </View>
        </View>

        <FooterSection text={footerText} S={S} />
      </Page>
    </Document>
  );
}

// ─── Document FACTURE ─────────────────────────────────────────────────────────

function FactureDocument({ facture, client, entreprise, logoDataUrl, templateCfg }: FactureDocParams) {
  const cfg = templateCfg ?? {};
  const S = makeStyles(cfg);

  const showRib = cfg.afficherRib !== false;
  const footerText = cfg.piedDePage?.trim() || null;

  const ent = buildEntrepriseLines(entreprise ?? {});
  const cli = buildClientLines(client, safe(client?.nom || facture.client));

  const isAcompte   = facture.type === 3;
  const isAvoir     = facture.type === 2;
  const isSituation = facture.type === 5;
  const titre = isAcompte ? "FACTURE D'ACOMPTE"
    : isAvoir ? 'AVOIR'
    : isSituation ? 'FACTURE DE SITUATION'
    : 'FACTURE';

  const montantAffiche = isAcompte
    ? Math.round(facture.montantTTC * 0.30 * 100) / 100
    : !facture.paye && facture.resteAPayer > 0 ? facture.resteAPayer : facture.montantTTC;

  const labelNet = isAcompte ? 'ACOMPTE À PAYER'
    : facture.paye ? 'TOTAL TTC — PAYÉE'
    : facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC ? 'RESTE À PAYER'
    : 'NET À PAYER';

  const tvaMap: Record<string, number> = {};
  (facture.lignes || []).forEach(l => {
    if (l.tauxTVA > 0) {
      const k = `${l.tauxTVA}`;
      tvaMap[k] = (tvaMap[k] || 0) + l.totalHT * l.tauxTVA / 100;
    }
  });

  const totRows = [
    { label: 'TOTAL HT :', value: `${fmt(facture.montantHT)} €` },
    ...(Object.keys(tvaMap).length > 0
      ? Object.entries(tvaMap).map(([taux, mt]) => ({ label: `TVA (${taux}%) :`, value: `${fmt(mt)} €` }))
      : [{ label: 'TVA :', value: `${fmt(facture.montantTTC - facture.montantHT)} €` }]),
    { label: 'TOTAL TTC :', value: `${fmt(facture.montantTTC)} €`, large: true },
  ];

  const echeanceStr = (facture as any).echeance ? dateFR((facture as any).echeance) : 'À réception';

  return (
    <Document title={`${titre} ${facture.ref}`} author={ent.nom}>
      <Page size="A4" style={S.page}>
        <LogoSection logoDataUrl={logoDataUrl} S={S} />

        <Text style={S.titre}>{titre}</Text>
        <Text style={S.refLine}>NUMÉRO : {safe(facture.ref)}</Text>

        <InfoBar cells={[
          { label: 'Référence',      value: safe(facture.ref) },
          { label: 'Date',           value: dateFR(facture.date) },
          { label: 'Échéance',       value: echeanceStr },
        ]} S={S} />

        <Parties
          clientNom={cli.nom} clientLines={cli.lines}
          entNom={ent.nom} entLines={ent.lines}
          S={S}
        />

        <LignesTable lignes={facture.lignes || []} S={S} />

        <View style={S.sepThin} />

        <Totaux rows={totRows} S={S} />

        {/* Net à payer */}
        <View style={S.netBlock}>
          <Text style={S.netText}>{labelNet} : {fmt(montantAffiche)} €</Text>
          {!facture.paye && facture.resteAPayer > 0 && facture.resteAPayer < facture.montantTTC && !isAcompte && (
            <Text style={S.netSub}>
              Total TTC : {fmt(facture.montantTTC)} €  |  Déjà réglé : {fmt(facture.montantTTC - facture.resteAPayer)} €
            </Text>
          )}
        </View>

        {showRib && <RibSection iban={ent.iban} bic={ent.bic} S={S} />}
        <FooterSection text={footerText} S={S} />
      </Page>
    </Document>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function SharedDocument(params: SharedDocParams) {
  if (params.type === 'devis')        return <DevisDocument        {...params} />;
  if (params.type === 'intervention') return <InterventionDocument {...params} />;
  return                                     <FactureDocument       {...params} />;
}
