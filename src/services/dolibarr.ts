// Dolibarr API Service — mock data for now, swap to real API later

export interface Facture {
  id: string;
  ref: string;
  client: string;
  date: string;
  montantTTC: number;
  statut: 'payée' | 'impayée' | 'en retard';
}

export interface DevisLigne {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  totalHT: number;
}

export interface Devis {
  id: string;
  ref: string;
  client: string;
  date: string;
  montantTTC: number;
  statut: 'en attente' | 'accepté' | 'refusé';
  lignes: DevisLigne[];
}

export interface Intervention {
  id: string;
  ref: string;
  client: string;
  technicien: string;
  date: string;
  statut: 'planifié' | 'en cours' | 'terminé' | 'annulé';
  description: string;
}

export interface Client {
  id: string;
  nom: string;
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
  tauxTVA: number;
  type: 'service' | 'produit';
  categorie: string;
}

// --- Mock Data ---

export const mockFactures: Facture[] = [
  { id: '1', ref: 'FA-2024-001', client: 'Copropriété Les Érables', date: '2024-12-15', montantTTC: 8500, statut: 'payée' },
  { id: '2', ref: 'FA-2024-002', client: 'M. Dupont Jean', date: '2024-12-18', montantTTC: 3200, statut: 'payée' },
  { id: '3', ref: 'FA-2024-003', client: 'SCI Bâtiment Central', date: '2025-01-05', montantTTC: 15400, statut: 'impayée' },
  { id: '4', ref: 'FA-2024-004', client: 'Mme. Martin Sophie', date: '2025-01-10', montantTTC: 1850, statut: 'payée' },
  { id: '5', ref: 'FA-2024-005', client: 'Restaurant Le Provençal', date: '2025-01-20', montantTTC: 6700, statut: 'en retard' },
  { id: '6', ref: 'FA-2025-006', client: 'Hôtel Bellevue', date: '2025-02-01', montantTTC: 12300, statut: 'impayée' },
  { id: '7', ref: 'FA-2025-007', client: 'M. Bernard Luc', date: '2025-02-10', montantTTC: 2100, statut: 'payée' },
  { id: '8', ref: 'FA-2025-008', client: 'Copropriété Résidence du Parc', date: '2025-03-01', montantTTC: 9800, statut: 'payée' },
];

export const mockDevis: Devis[] = [
  {
    id: '1', ref: 'DE-2025-001', client: 'Copropriété Les Chênes', date: '2025-03-10', montantTTC: 7800, statut: 'en attente',
    lignes: [
      { designation: 'Mise aux normes NF C 15-100 - Parties communes', quantite: 1, prixUnitaire: 4200, totalHT: 4200 },
      { designation: 'Remplacement tableau général', quantite: 1, prixUnitaire: 1800, totalHT: 1800 },
      { designation: 'Câblage cuivre 3G2.5', quantite: 120, prixUnitaire: 5, totalHT: 600 },
    ],
  },
  {
    id: '2', ref: 'DE-2025-002', client: 'M. Leroy Pierre', date: '2025-03-12', montantTTC: 3200, statut: 'en attente',
    lignes: [
      { designation: 'Installation tableau électrique complet', quantite: 1, prixUnitaire: 1500, totalHT: 1500 },
      { designation: 'Pose prises et interrupteurs', quantite: 18, prixUnitaire: 55, totalHT: 990 },
      { designation: 'Tirage de ligne cuisine dédiée', quantite: 2, prixUnitaire: 85, totalHT: 170 },
    ],
  },
  {
    id: '3', ref: 'DE-2025-003', client: 'SCI Immobilière du Sud', date: '2025-03-15', montantTTC: 24500, statut: 'accepté',
    lignes: [
      { designation: 'Rénovation complète électricité - 6 appartements', quantite: 6, prixUnitaire: 3200, totalHT: 19200 },
      { designation: 'Main d\'œuvre installation', quantite: 40, prixUnitaire: 45, totalHT: 1800 },
    ],
  },
  {
    id: '4', ref: 'DE-2025-004', client: 'Mme. Garcia Ana', date: '2025-03-20', montantTTC: 1950, statut: 'en attente',
    lignes: [
      { designation: 'Dépannage et diagnostic panne générale', quantite: 1, prixUnitaire: 250, totalHT: 250 },
      { designation: 'Remplacement disjoncteur différentiel 30mA', quantite: 3, prixUnitaire: 180, totalHT: 540 },
      { designation: 'Vérification et test installation', quantite: 1, prixUnitaire: 150, totalHT: 150 },
    ],
  },
  {
    id: '5', ref: 'DE-2025-005', client: 'Boulangerie Chez Paul', date: '2025-03-25', montantTTC: 5600, statut: 'refusé',
    lignes: [
      { designation: 'Installation four professionnel triphasé', quantite: 1, prixUnitaire: 2800, totalHT: 2800 },
      { designation: 'Mise en conformité local professionnel', quantite: 1, prixUnitaire: 1600, totalHT: 1600 },
    ],
  },
];

export const mockInterventions: Intervention[] = [
  { id: '1', ref: 'INT-2025-001', client: 'M. Dupont Jean', technicien: 'Thomas Moreau', date: '2025-04-11', statut: 'en cours', description: 'Dépannage panne tableau électrique' },
  { id: '2', ref: 'INT-2025-002', client: 'Copropriété Les Érables', technicien: 'Lucas Martin', date: '2025-04-11', statut: 'planifié', description: 'Mise aux normes NF C 15-100' },
  { id: '3', ref: 'INT-2025-003', client: 'Restaurant Le Provençal', technicien: 'Thomas Moreau', date: '2025-04-12', statut: 'planifié', description: 'Installation éclairage LED salle' },
  { id: '4', ref: 'INT-2025-004', client: 'Mme. Martin Sophie', technicien: 'Nicolas Petit', date: '2025-04-09', statut: 'terminé', description: 'Remplacement tableau divisionnaire' },
  { id: '5', ref: 'INT-2025-005', client: 'SCI Bâtiment Central', technicien: 'Lucas Martin', date: '2025-04-08', statut: 'terminé', description: 'Câblage réseau RJ45 bureaux' },
  { id: '6', ref: 'INT-2025-006', client: 'Hôtel Bellevue', technicien: 'Nicolas Petit', date: '2025-04-14', statut: 'planifié', description: 'Diagnostic installation générale' },
  { id: '7', ref: 'INT-2025-007', client: 'M. Bernard Luc', technicien: 'Thomas Moreau', date: '2025-04-07', statut: 'annulé', description: 'Installation borne recharge véhicule' },
  { id: '8', ref: 'INT-2025-008', client: 'Copropriété Résidence du Parc', technicien: 'Lucas Martin', date: '2025-04-15', statut: 'planifié', description: 'Remplacement colonnes montantes' },
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
  { id: '1', ref: 'SRV-001', label: 'Installation tableau électrique', description: 'Fourniture et pose d\'un tableau électrique complet NF C 15-100', prixHT: 1500, tauxTVA: 10, type: 'service', categorie: 'Installation' },
  { id: '2', ref: 'SRV-002', label: 'Mise aux normes NF C 15-100', description: 'Diagnostic et mise en conformité de l\'installation électrique', prixHT: 4200, tauxTVA: 10, type: 'service', categorie: 'Mise aux normes' },
  { id: '3', ref: 'SRV-003', label: 'Forfait dépannage urgence', description: 'Intervention d\'urgence dépannage électrique (1h)', prixHT: 150, tauxTVA: 20, type: 'service', categorie: 'Dépannage' },
  { id: '4', ref: 'SRV-004', label: 'Tirage de câble RJ45', description: 'Tirage et raccordement câble réseau catégorie 6', prixHT: 45, tauxTVA: 20, type: 'service', categorie: 'Réseau' },
  { id: '5', ref: 'SRV-005', label: 'Installation borne de recharge VE', description: 'Fourniture et pose borne de recharge véhicule électrique 7kW', prixHT: 1800, tauxTVA: 10, type: 'service', categorie: 'Installation' },
  { id: '6', ref: 'PRD-001', label: 'Disjoncteur différentiel 30mA', description: 'Disjoncteur différentiel type A 30mA 40A', prixHT: 85, tauxTVA: 20, type: 'produit', categorie: 'Matériel' },
  { id: '7', ref: 'PRD-002', label: 'Câble R2V 3G2.5', description: 'Câble électrique R2V 3G2.5mm² - au mètre', prixHT: 3.5, tauxTVA: 20, type: 'produit', categorie: 'Matériel' },
  { id: '8', ref: 'SRV-006', label: 'Diagnostic électrique complet', description: 'Diagnostic de l\'installation avec rapport détaillé', prixHT: 250, tauxTVA: 20, type: 'service', categorie: 'Diagnostic' },
  { id: '9', ref: 'SRV-007', label: 'Installation éclairage LED', description: 'Fourniture et pose éclairage LED intérieur/extérieur', prixHT: 75, tauxTVA: 10, type: 'service', categorie: 'Installation' },
  { id: '10', ref: 'SRV-008', label: 'Rénovation électrique appartement', description: 'Rénovation complète installation électrique appartement T3', prixHT: 3200, tauxTVA: 10, type: 'service', categorie: 'Rénovation' },
];

// --- API Config (for future real connection) ---

let API_BASE_URL = '';
let API_KEY = '';

export function configureDolibarr(baseUrl: string, apiKey: string) {
  API_BASE_URL = baseUrl;
  API_KEY = apiKey;
}

export function isConfigured(): boolean {
  return API_BASE_URL !== '' && API_KEY !== '';
}

// --- API Fetch functions (return mock data for now) ---

export async function fetchFactures(): Promise<Facture[]> {
  if (!isConfigured()) return mockFactures;
  const res = await fetch(`${API_BASE_URL}/api/index.php/invoices`, { headers: { DOLAPIKEY: API_KEY } });
  return res.json();
}

export async function fetchDevis(): Promise<Devis[]> {
  if (!isConfigured()) return mockDevis;
  const res = await fetch(`${API_BASE_URL}/api/index.php/proposals`, { headers: { DOLAPIKEY: API_KEY } });
  return res.json();
}

export async function fetchInterventions(): Promise<Intervention[]> {
  if (!isConfigured()) return mockInterventions;
  const res = await fetch(`${API_BASE_URL}/api/index.php/interventions`, { headers: { DOLAPIKEY: API_KEY } });
  return res.json();
}

export async function fetchClients(): Promise<Client[]> {
  if (!isConfigured()) return mockClients;
  const res = await fetch(`${API_BASE_URL}/api/index.php/thirdparties`, { headers: { DOLAPIKEY: API_KEY } });
  return res.json();
}

export async function fetchProduits(): Promise<Produit[]> {
  if (!isConfigured()) return mockProduits;
  const res = await fetch(`${API_BASE_URL}/api/index.php/products`, { headers: { DOLAPIKEY: API_KEY } });
  return res.json();
}

// Helpers
export function getAcompteBadge(montantTTC: number): { label: string; variant: 'green' | 'orange' } {
  return montantTTC > 5000
    ? { label: 'Acompte 30% requis', variant: 'green' }
    : { label: 'Acompte 50% requis', variant: 'orange' };
}

export const techniciens = ['Thomas Moreau', 'Lucas Martin', 'Nicolas Petit'];
export const statutsIntervention = ['planifié', 'en cours', 'terminé', 'annulé'] as const;
