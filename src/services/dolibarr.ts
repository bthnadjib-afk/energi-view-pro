// Dolibarr API Service — proxy through edge function, fallback to mock data

import { supabase } from '@/integrations/supabase/client';

// --- Types ---

export interface Facture {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  date: string;
  montantHT: number;
  montantTTC: number;
  statut: 'brouillon' | 'payée' | 'impayée' | 'en retard';
}

export interface DevisLigne {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  totalHT: number;
  prixAchat?: number;
}

export interface Devis {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  date: string;
  montantHT: number;
  montantTTC: number;
  statut: 'brouillon' | 'en attente' | 'accepté' | 'refusé';
  lignes: DevisLigne[];
}

export type InterventionType = 'devis_sur_place' | 'panne' | 'sav' | 'chantier' | 'realisation';

export type InterventionStatut = 'brouillon' | 'validé' | 'en cours' | 'terminé' | 'facturé' | 'annulé';

export interface Intervention {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  technicien: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  statut: InterventionStatut;
  type: InterventionType;
  description: string;
  descriptionClient?: string;
  compteRendu?: string;
  noteClient?: string;
  noteTechnicien?: string;
  noteFinChantier?: string;
  notePrivee?: string;
  signatureBase64?: string;
  signatureTechnicien?: string;
  photos?: string[];
}

export interface Client {
  id: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville: string;
  telephone: string;
  email: string;
  projetsEnCours: number;
}

export interface Produit {
  id: string;
  ref: string;
  label: string;
  description: string;
  prixHT: number;
  prixAchat?: number;
  tauxTVA: number;
  type: 'main_oeuvre' | 'fourniture';
  categorie: string;
}

// --- Proxy call ---

async function dolibarrCall<T>(endpoint: string, method = 'GET', data?: unknown): Promise<T | null> {
  try {
    const { data: result, error } = await supabase.functions.invoke('dolibarr-proxy', {
      body: { endpoint, method, data },
    });
    if (error) throw error;
    // The proxy always returns 200 with { ok, status, data, error }
    if (result && typeof result === 'object' && 'ok' in result) {
      if (!result.ok) {
        const errMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error || `Dolibarr ${result.status}`);
        console.warn(`Dolibarr API ${result.status}:`, result.error);
        if (method !== 'GET') throw new Error(errMsg);
        return null;
      }
      return result.data as T;
    }
    // Fallback for legacy format
    return result as T;
  } catch (e) {
    console.warn('Dolibarr proxy error:', e);
    if (method !== 'GET') throw e;
    return null;
  }
}

// --- Date helper ---

export function formatDateFR(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
}

function toUnixTimestamp(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// --- Client name resolution cache ---

let clientsCachePromise: Promise<Client[]> | null = null;

async function getClientsCache(): Promise<Client[]> {
  if (!clientsCachePromise) {
    clientsCachePromise = fetchClientsRaw();
    setTimeout(() => { clientsCachePromise = null; }, 60000);
  }
  return clientsCachePromise;
}

function resolveClientName(socid: string | undefined, clients: Client[], fallback: string): string {
  if (!socid) return fallback;
  const c = clients.find(cl => cl.id === String(socid));
  return c ? c.nom : fallback;
}

// --- Mock Data ---

export const mockFactures: Facture[] = [
  { id: '1', ref: 'FA-2024-001', client: 'Copropriété Les Érables', date: '2024-12-15', montantHT: 7083, montantTTC: 8500, statut: 'payée' },
  { id: '2', ref: 'FA-2024-002', client: 'M. Dupont Jean', date: '2024-12-18', montantHT: 2667, montantTTC: 3200, statut: 'payée' },
  { id: '3', ref: 'FA-2024-003', client: 'SCI Bâtiment Central', date: '2025-01-05', montantHT: 12833, montantTTC: 15400, statut: 'impayée' },
  { id: '4', ref: 'FA-2024-004', client: 'Mme. Martin Sophie', date: '2025-01-10', montantHT: 1542, montantTTC: 1850, statut: 'payée' },
  { id: '5', ref: 'FA-2024-005', client: 'Restaurant Le Provençal', date: '2025-01-20', montantHT: 5583, montantTTC: 6700, statut: 'en retard' },
  { id: '6', ref: 'FA-2025-006', client: 'Hôtel Bellevue', date: '2025-02-01', montantHT: 10250, montantTTC: 12300, statut: 'impayée' },
  { id: '7', ref: 'FA-2025-007', client: 'M. Bernard Luc', date: '2025-02-10', montantHT: 1750, montantTTC: 2100, statut: 'payée' },
  { id: '8', ref: 'FA-2025-008', client: 'Copropriété Résidence du Parc', date: '2025-03-01', montantHT: 8167, montantTTC: 9800, statut: 'payée' },
];

export const mockDevis: Devis[] = [
  {
    id: '1', ref: 'DE-2025-001', client: 'Copropriété Les Chênes', date: '2025-03-10', montantHT: 6600, montantTTC: 7800, statut: 'en attente',
    lignes: [
      { designation: 'Mise aux normes NF C 15-100 - Parties communes', quantite: 1, prixUnitaire: 4200, totalHT: 4200 },
      { designation: 'Remplacement tableau général', quantite: 1, prixUnitaire: 1800, totalHT: 1800 },
      { designation: 'Câblage cuivre 3G2.5', quantite: 120, prixUnitaire: 5, totalHT: 600 },
    ],
  },
  {
    id: '2', ref: 'DE-2025-002', client: 'M. Leroy Pierre', date: '2025-03-12', montantHT: 2660, montantTTC: 3200, statut: 'en attente',
    lignes: [
      { designation: 'Installation tableau électrique complet', quantite: 1, prixUnitaire: 1500, totalHT: 1500 },
      { designation: 'Pose prises et interrupteurs', quantite: 18, prixUnitaire: 55, totalHT: 990 },
      { designation: 'Tirage de ligne cuisine dédiée', quantite: 2, prixUnitaire: 85, totalHT: 170 },
    ],
  },
  {
    id: '3', ref: 'DE-2025-003', client: 'SCI Immobilière du Sud', date: '2025-03-15', montantHT: 21000, montantTTC: 24500, statut: 'accepté',
    lignes: [
      { designation: 'Rénovation complète électricité - 6 appartements', quantite: 6, prixUnitaire: 3200, totalHT: 19200 },
      { designation: 'Main d\'œuvre installation', quantite: 40, prixUnitaire: 45, totalHT: 1800 },
    ],
  },
  {
    id: '4', ref: 'DE-2025-004', client: 'Mme. Garcia Ana', date: '2025-03-20', montantHT: 940, montantTTC: 1950, statut: 'en attente',
    lignes: [
      { designation: 'Dépannage et diagnostic panne générale', quantite: 1, prixUnitaire: 250, totalHT: 250 },
      { designation: 'Remplacement disjoncteur différentiel 30mA', quantite: 3, prixUnitaire: 180, totalHT: 540 },
      { designation: 'Vérification et test installation', quantite: 1, prixUnitaire: 150, totalHT: 150 },
    ],
  },
  {
    id: '5', ref: 'DE-2025-005', client: 'Boulangerie Chez Paul', date: '2025-03-25', montantHT: 4400, montantTTC: 5600, statut: 'refusé',
    lignes: [
      { designation: 'Installation four professionnel triphasé', quantite: 1, prixUnitaire: 2800, totalHT: 2800 },
      { designation: 'Mise en conformité local professionnel', quantite: 1, prixUnitaire: 1600, totalHT: 1600 },
    ],
  },
];

export const mockInterventions: Intervention[] = [
  { id: '1', ref: 'INT-2025-001', client: 'M. Dupont Jean', technicien: 'Thomas Moreau', date: '2025-04-11', heureDebut: '08:00', heureFin: '10:00', statut: 'en cours', type: 'panne', description: 'Dépannage panne tableau électrique' },
  { id: '2', ref: 'INT-2025-002', client: 'Copropriété Les Érables', technicien: 'Lucas Martin', date: '2025-04-11', heureDebut: '09:00', heureFin: '12:00', statut: 'validé', type: 'chantier', description: 'Mise aux normes NF C 15-100' },
  { id: '3', ref: 'INT-2025-003', client: 'Restaurant Le Provençal', technicien: 'Thomas Moreau', date: '2025-04-12', heureDebut: '14:00', heureFin: '17:00', statut: 'validé', type: 'realisation', description: 'Installation éclairage LED salle' },
  { id: '4', ref: 'INT-2025-004', client: 'Mme. Martin Sophie', technicien: 'Nicolas Petit', date: '2025-04-09', heureDebut: '08:00', heureFin: '11:00', statut: 'terminé', type: 'chantier', description: 'Remplacement tableau divisionnaire' },
  { id: '5', ref: 'INT-2025-005', client: 'SCI Bâtiment Central', technicien: 'Lucas Martin', date: '2025-04-08', heureDebut: '09:00', heureFin: '16:00', statut: 'facturé', type: 'realisation', description: 'Câblage réseau RJ45 bureaux' },
  { id: '6', ref: 'INT-2025-006', client: 'Hôtel Bellevue', technicien: 'Nicolas Petit', date: '2025-04-14', heureDebut: '10:00', heureFin: '12:00', statut: 'brouillon', type: 'devis_sur_place', description: 'Diagnostic installation générale' },
  { id: '7', ref: 'INT-2025-007', client: 'M. Bernard Luc', technicien: 'Thomas Moreau', date: '2025-04-07', heureDebut: '13:00', heureFin: '15:00', statut: 'annulé', type: 'sav', description: 'Installation borne recharge véhicule' },
  { id: '8', ref: 'INT-2025-008', client: 'Copropriété Résidence du Parc', technicien: 'Lucas Martin', date: '2025-04-15', heureDebut: '08:00', heureFin: '17:00', statut: 'validé', type: 'chantier', description: 'Remplacement colonnes montantes' },
];

export const mockClients: Client[] = [
  { id: '1', nom: 'Copropriété Les Érables', ville: 'Lyon', telephone: '04 72 11 22 33', email: 'syndic@erables.fr', projetsEnCours: 2 },
  { id: '2', nom: 'M. Dupont Jean', ville: 'Villeurbanne', telephone: '06 12 34 56 78', email: 'jean.dupont@mail.fr', projetsEnCours: 1 },
  { id: '3', nom: 'SCI Bâtiment Central', ville: 'Lyon 3e', telephone: '04 78 55 66 77', email: 'contact@sci-central.fr', projetsEnCours: 1 },
  { id: '4', nom: 'Mme. Martin Sophie', ville: 'Caluire', telephone: '06 98 76 54 32', email: 'sophie.martin@mail.fr', projetsEnCours: 0 },
  { id: '5', nom: 'Restaurant Le Provençal', ville: 'Lyon 2e', telephone: '04 72 33 44 55', email: 'contact@provencal.fr', projetsEnCours: 1 },
  { id: '6', nom: 'Hôtel Bellevue', ville: 'Lyon 5e', telephone: '04 78 22 11 00', email: 'direction@bellevue.fr', projetsEnCours: 1 },
  { id: '7', nom: 'M. Bernard Luc', ville: 'Bron', telephone: '06 55 44 33 22', email: 'luc.bernard@mail.fr', projetsEnCours: 0 },
  { id: '8', nom: 'Copropriété Résidence du Parc', ville: 'Écully', telephone: '04 78 99 88 77', email: 'syndic@residenceduparc.fr', projetsEnCours: 1 },
  { id: '9', nom: 'Boulangerie Chez Paul', ville: 'Vénissieux', telephone: '04 72 88 99 00', email: 'paul@chezpaul.fr', projetsEnCours: 0 },
  { id: '10', nom: 'SCI Immobilière du Sud', ville: 'Saint-Priest', telephone: '04 78 20 30 40', email: 'contact@sci-sud.fr', projetsEnCours: 1 },
];

export const mockProduits: Produit[] = [
  { id: '1', ref: 'MO001', label: 'Installation tableau électrique', description: 'Fourniture et pose d\'un tableau électrique complet NF C 15-100', prixHT: 1500, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Installation' },
  { id: '2', ref: 'MO002', label: 'Mise aux normes NF C 15-100', description: 'Diagnostic et mise en conformité de l\'installation électrique', prixHT: 4200, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Mise aux normes' },
  { id: '3', ref: 'MO003', label: 'Forfait dépannage urgence', description: 'Intervention d\'urgence dépannage électrique (1h)', prixHT: 150, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Dépannage' },
  { id: '4', ref: 'MO004', label: 'Tirage de câble RJ45', description: 'Tirage et raccordement câble réseau catégorie 6', prixHT: 45, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Réseau' },
  { id: '5', ref: 'MO005', label: 'Installation borne de recharge VE', description: 'Fourniture et pose borne de recharge véhicule électrique 7kW', prixHT: 1800, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Installation' },
  { id: '6', ref: '0001', label: 'Disjoncteur différentiel 30mA', description: 'Disjoncteur différentiel type A 30mA 40A', prixHT: 85, prixAchat: 42, tauxTVA: 0, type: 'fourniture', categorie: 'Matériel' },
  { id: '7', ref: '0002', label: 'Câble R2V 3G2.5', description: 'Câble électrique R2V 3G2.5mm² - au mètre', prixHT: 3.5, prixAchat: 1.8, tauxTVA: 0, type: 'fourniture', categorie: 'Matériel' },
  { id: '8', ref: 'MO006', label: 'Diagnostic électrique complet', description: 'Diagnostic de l\'installation avec rapport détaillé', prixHT: 250, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Diagnostic' },
  { id: '9', ref: 'MO007', label: 'Installation éclairage LED', description: 'Fourniture et pose éclairage LED intérieur/extérieur', prixHT: 75, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Installation' },
  { id: '10', ref: 'MO008', label: 'Rénovation électrique appartement', description: 'Rénovation complète installation électrique appartement T3', prixHT: 3200, tauxTVA: 0, type: 'main_oeuvre', categorie: 'Rénovation' },
];

// --- Raw fetch (no client resolution) ---

async function fetchClientsRaw(): Promise<Client[]> {
  const result = await dolibarrCall<any[]>('/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=100');
  if (!result) return mockClients;
  return result.map(mapDolibarrClient);
}

// --- API Fetch functions (proxy with mock fallback + client name resolution) ---

export async function fetchFactures(): Promise<Facture[]> {
  const result = await dolibarrCall<any[]>('/invoices?sortfield=t.rowid&sortorder=DESC&limit=50');
  if (!result) return mockFactures;
  const mapped = result.map(mapDolibarrFacture);
  try {
    const clients = await getClientsCache();
    return mapped.map(f => ({ ...f, client: resolveClientName(f.socid, clients, f.client) }));
  } catch { return mapped; }
}

export async function fetchDevis(): Promise<Devis[]> {
  const result = await dolibarrCall<any[]>('/proposals?sortfield=t.rowid&sortorder=DESC&limit=50');
  if (!result) return mockDevis;
  const mapped = result.map(mapDolibarrDevis);
  try {
    const clients = await getClientsCache();
    return mapped.map(d => ({ ...d, client: resolveClientName(d.socid, clients, d.client) }));
  } catch { return mapped; }
}

export async function fetchInterventions(): Promise<Intervention[]> {
  const result = await dolibarrCall<any[]>('/interventions?sortfield=t.rowid&sortorder=DESC&limit=50');
  if (!result) return mockInterventions;
  const mapped = result.map(mapDolibarrIntervention);
  try {
    const clients = await getClientsCache();
    return mapped.map(i => ({ ...i, client: resolveClientName(i.socid, clients, i.client) }));
  } catch { return mapped; }
}

export async function fetchClients(): Promise<Client[]> {
  return fetchClientsRaw();
}

export async function fetchProduits(): Promise<Produit[]> {
  const result = await dolibarrCall<any[]>('/products?sortfield=t.rowid&sortorder=DESC&limit=100');
  if (!result) return mockProduits;
  return result.map(mapDolibarrProduit);
}

// --- Mutation functions ---

export async function createClient(data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }): Promise<string> {
  const result = await dolibarrCall<string>('/thirdparties', 'POST', {
    name: data.nom,
    address: data.adresse || '',
    zip: data.codePostal || '',
    town: data.ville || '',
    phone: data.telephone || '',
    email: data.email || '',
    client: 1,
  });
  return result || '';
}

export async function updateClient(id: string, data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }): Promise<string | null> {
  return dolibarrCall<string>(`/thirdparties/${id}`, 'PUT', {
    name: data.nom,
    address: data.adresse || '',
    zip: data.codePostal || '',
    town: data.ville || '',
    phone: data.telephone || '',
    email: data.email || '',
  });
}

export async function deleteClient(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/thirdparties/${id}`, 'DELETE');
}

export async function updateProduit(id: string, data: { label: string; description?: string; price: number; type: number }): Promise<string | null> {
  return dolibarrCall<string>(`/products/${id}`, 'PUT', {
    label: data.label,
    description: data.description || '',
    price: data.price,
    type: data.type,
  });
}

export async function updateIntervention(id: string, data: { description?: string }): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}`, 'PUT', data);
}

export async function createIntervention(data: { socid: string; description: string; date: string }): Promise<string> {
  const socidInt = parseInt(data.socid, 10) || data.socid;
  const ts = toUnixTimestamp(data.date);
  const result = await dolibarrCall<string>('/interventions', 'POST', {
    socid: socidInt,
    fk_soc: socidInt,
    fk_project: 0,
    description: data.description || ' ',
    datei: ts,
    dateo: ts,
  });
  return result || '';
}

// --- Devis status management ---

export async function updateDevis(id: string, socid: string, lines: CreateDevisLine[]): Promise<string> {
  const result = await dolibarrCall<string>(`/proposals/${id}`, 'PUT', {
    socid: parseInt(socid, 10) || socid,
    lines,
  });
  return result || '';
}

export async function validateDevis(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/validate`, 'POST');
}

export async function closeDevis(id: string, status: number): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/close`, 'POST', { status });
}

export async function deleteDevis(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}`, 'DELETE');
}

export async function deleteFacture(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}`, 'DELETE');
}

export async function deleteProduit(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/products/${id}`, 'DELETE');
}

export async function deleteIntervention(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}`, 'DELETE');
}

// --- Dolibarr user sync ---

export async function createDolibarrUser(data: { login: string; firstname: string; lastname: string; email: string }): Promise<string | null> {
  return dolibarrCall<string>('/users', 'POST', {
    login: data.login,
    firstname: data.firstname,
    lastname: data.lastname,
    email: data.email,
    statut: 1,
  });
}

// --- Email variable replacement ---

export function replaceEmailVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([A-Z_]+)\]/g, (match, key) => vars[key] || match);
}

export interface CreateDevisLine {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type?: number;
}

export async function createDevis(socid: string, lines: CreateDevisLine[]): Promise<string> {
  const result = await dolibarrCall<string>('/proposals', 'POST', {
    socid: parseInt(socid, 10) || socid,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
  });
  return result || '';
}

export async function createFacture(socid: string, lines: CreateDevisLine[]): Promise<string> {
  const result = await dolibarrCall<string>('/invoices', 'POST', {
    socid: parseInt(socid, 10) || socid,
    type: 0,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
  });
  return result || '';
}

export async function createProduit(data: { ref: string; label: string; description?: string; price: number; tva_tx: number; type: number }): Promise<string> {
  const result = await dolibarrCall<string>('/products', 'POST', {
    ref: data.ref,
    label: data.label,
    description: data.description || '',
    price: data.price,
    tva_tx: data.tva_tx,
    type: data.type,
    status: 1,
    status_buy: 1,
  });
  return result || '';
}

export async function convertDevisToFacture(devisId: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${devisId}/createinvoice`, 'POST');
}

export async function createAcompteFacture(socid: string, montantHT: number, devisRef: string): Promise<string> {
  const tauxAcompte = montantHT > 5000 ? 0.3 : 0.5;
  const montantAcompte = Math.round(montantHT * tauxAcompte * 100) / 100;
  const result = await dolibarrCall<string>('/invoices', 'POST', {
    socid: parseInt(socid, 10) || socid,
    type: 3,
    date: toUnixTimestamp(new Date().toISOString()),
    lines: [{
      desc: `Acompte ${Math.round(tauxAcompte * 100)}% — ${devisRef}`,
      qty: 1,
      subprice: montantAcompte,
      tva_tx: 0,
      product_type: 1,
    }],
  });
  return result || '';
}

// --- PDF generation via Dolibarr builddoc ---
// Dolibarr modulepart values: 'proposal' for devis, 'invoice' for factures, 'intervention' for interventions

export type DolibarrModulepart = 'propal' | 'facture' | 'ficheinter';

export async function generatePDF(
  modulepart: DolibarrModulepart,
  id: string,
  ref: string,
  model?: string
): Promise<string | null> {
  const defaultModel = modulepart === 'propal' ? 'azur' : modulepart === 'facture' ? 'crabe' : 'soleil';
  const result = await dolibarrCall<any>('/documents/builddoc', 'PUT', {
    modulepart,
    original_file: `${ref}/${ref}.pdf`,
    doctemplate: model || defaultModel,
    langcode: 'fr_FR',
  });
  if (!result) return null;
  // builddoc returns { filename, content-type, filesize, content, ... }
  // If content is present, create a blob URL (NO window.open — caller decides)
  if (result.content) {
    const byteChars = atob(result.content);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }
  return result?.filename || result;
}

// Helper to open PDF in a new tab via blob download (avoids ERR_BLOCKED_BY_CLIENT)
export function openPDFInNewTab(blobUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadPDFUrl(
  modulepart: DolibarrModulepart,
  ref: string
): Promise<string | null> {
  const result = await dolibarrCall<any>(
    `/documents/download?modulepart=${modulepart}&original_file=${encodeURIComponent(ref + '/' + ref + '.pdf')}`,
    'GET'
  );
  if (!result?.content) return null;
  const byteChars = atob(result.content);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

// --- Validation ---

export async function validateFacture(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}/validate`, 'POST');
}

export async function validateIntervention(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}/validate`, 'POST');
}

// --- Send by email ---

export async function sendDevisByEmail(id: string, to: string, subject: string, message: string): Promise<any> {
  return dolibarrCall<any>(`/proposals/${id}/sendByEmail`, 'POST', {
    sendto: to,
    subject,
    message,
    model: 'azur',
  });
}

export async function sendFactureByEmail(id: string, to: string, subject: string, message: string): Promise<any> {
  return dolibarrCall<any>(`/invoices/${id}/sendByEmail`, 'POST', {
    sendto: to,
    subject,
    message,
    model: 'crabe',
  });
}

export async function sendInterventionByEmail(id: string, to: string, subject: string, message: string): Promise<any> {
  return dolibarrCall<any>(`/interventions/${id}/sendByEmail`, 'POST', {
    sendto: to,
    subject,
    message,
    model: 'soleil',
  });
}

// --- Bulk delete ---

export async function bulkDeleteDevis(ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(id => dolibarrCall(`/proposals/${id}`, 'DELETE')));
}

export async function bulkDeleteFactures(ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(id => dolibarrCall(`/invoices/${id}`, 'DELETE')));
}

// --- Update devis/facture lines (PUT, draft only) ---

export async function updateDevisLines(id: string, socid: string, lines: CreateDevisLine[]): Promise<string> {
  const result = await dolibarrCall<string>(`/proposals/${id}`, 'PUT', {
    socid: parseInt(socid, 10) || socid,
    lines,
  });
  return result || '';
}

export async function updateFactureLines(id: string, socid: string, lines: CreateDevisLine[]): Promise<string> {
  const result = await dolibarrCall<string>(`/invoices/${id}`, 'PUT', {
    socid: parseInt(socid, 10) || socid,
    lines,
  });
  return result || '';
}

// --- Check payment status ---

export async function checkAcomptePayment(factureId: string): Promise<{ paye: boolean; totalPaie: number }> {
  const result = await dolibarrCall<any>(`/invoices/${factureId}`);
  if (!result) return { paye: false, totalPaie: 0 };
  return {
    paye: result.paye === '1' || result.paye === 1,
    totalPaie: parseFloat(result.sumpayed || result.total_paye || '0') || 0,
  };
}

function toast_info(msg: string) {
  console.log(msg);
}

export async function testDolibarrConnection(): Promise<boolean> {
  const result = await dolibarrCall<any>('/status');
  return result !== null;
}

// --- Helpers ---

function parseDolibarrDate(val: any): string {
  if (!val || val === '0') return '';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
  const num = Number(val);
  if (!isNaN(num) && num > 0) {
    const d = new Date(num * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return '';
}

// --- Mapping Dolibarr → App types ---

function mapDolibarrFacture(d: any): Facture {
  let statut: Facture['statut'];
  if (d.paye === '1' || d.paye === 1) {
    statut = 'payée';
  } else if (String(d.fk_statut) === '0') {
    statut = 'brouillon';
  } else if (String(d.fk_statut) === '1') {
    statut = 'impayée';
  } else if (String(d.fk_statut) === '2') {
    statut = 'payée';
  } else {
    statut = 'en retard';
  }
  return {
    id: String(d.id),
    ref: d.ref || `FA-${d.id}`,
    client: d.thirdparty?.name || d.nom || d.client_nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    date: parseDolibarrDate(d.date || d.datef || d.date_creation),
    montantHT: parseFloat(d.total_ht) || 0,
    montantTTC: parseFloat(d.total_ttc) || 0,
    statut,
  };
}

function mapDolibarrDevis(d: any): Devis {
  const statutMap: Record<string, Devis['statut']> = { '0': 'brouillon', '1': 'en attente', '2': 'accepté', '3': 'refusé' };
  const statut = statutMap[String(d.fk_statut)] || 'brouillon';
  return {
    id: String(d.id),
    ref: d.ref || `DE-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    date: parseDolibarrDate(d.date || d.datep || d.date_creation),
    montantHT: parseFloat(d.total_ht) || 0,
    montantTTC: parseFloat(d.total_ttc) || 0,
    statut,
    lignes: (d.lines || []).map((l: any) => ({
      designation: l.desc || l.label || '',
      quantite: parseFloat(l.qty) || 0,
      prixUnitaire: parseFloat(l.subprice) || 0,
      totalHT: parseFloat(l.total_ht) || 0,
      prixAchat: parseFloat(l.pa_ht) || 0,
    })),
  };
}

function mapDolibarrIntervention(d: any): Intervention {
  const statutMap: Record<string, InterventionStatut> = {
    '0': 'brouillon',
    '1': 'validé',
    '2': 'en cours',
    '3': 'terminé',
    '4': 'facturé',
    '5': 'annulé',
  };
  const technicien = d.array_options?.options_technicien || d.user_author?.firstname && `${d.user_author.firstname} ${d.user_author.lastname || ''}`.trim() || '';
  return {
    id: String(d.id),
    ref: d.ref || `INT-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    technicien,
    date: parseDolibarrDate(d.datei || d.dateo || d.date || d.date_creation),
    heureDebut: '08:00',
    heureFin: '10:00',
    statut: statutMap[String(d.fk_statut)] || 'brouillon',
    type: 'chantier',
    description: d.description || '',
    descriptionClient: d.note_public || '',
    compteRendu: d.note_private || '',
  };
}

function mapDolibarrClient(d: any): Client {
  return {
    id: String(d.id),
    nom: d.name || '',
    adresse: d.address || '',
    codePostal: d.zip || '',
    ville: d.town || '',
    telephone: d.phone || '',
    email: d.email || '',
    projetsEnCours: 0,
  };
}

function mapDolibarrProduit(d: any): Produit {
  return {
    id: String(d.id),
    ref: d.ref || '',
    label: d.label || '',
    description: d.description || '',
    prixHT: parseFloat(d.price) || 0,
    prixAchat: parseFloat(d.cost_price) || 0,
    tauxTVA: parseFloat(d.tva_tx) || 0,
    type: d.type === '1' ? 'main_oeuvre' : 'fourniture',
    categorie: '',
  };
}

// Helpers
export function getAcompteBadge(montantHT: number): { label: string; variant: 'green' | 'orange'; taux: number } {
  const taux = montantHT > 5000 ? 30 : 50;
  return {
    label: `Acompte ${taux}%`,
    variant: taux === 30 ? 'green' : 'orange',
    taux,
  };
}

export const techniciens = ['Thomas Moreau', 'Lucas Martin', 'Nicolas Petit'];
export const statutsIntervention: InterventionStatut[] = ['brouillon', 'validé', 'en cours', 'terminé', 'facturé', 'annulé'];
export const typesIntervention: { value: InterventionType; label: string }[] = [
  { value: 'devis_sur_place', label: 'Devis sur place' },
  { value: 'panne', label: 'Panne' },
  { value: 'sav', label: 'SAV' },
  { value: 'chantier', label: 'Chantier' },
  { value: 'realisation', label: 'Réalisation' },
];
