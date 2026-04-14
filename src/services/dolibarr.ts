// Dolibarr API Service — proxy through edge function, NO mock fallback

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
  statut: string;
  fk_statut: number;
  paye: boolean;
  resteAPayer: number;
  totalPaye: number;
  lignes: DevisLigne[];
  note_private?: string;
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
  statut: string;
  fk_statut: number;
  lignes: DevisLigne[];
  finValidite: string;
  note_private?: string;
}

export type InterventionType = 'devis' | 'panne' | 'panne_urgence' | 'sav' | 'chantier';

export type InterventionStatut = string;

export interface InterventionLine {
  id: string;
  description: string;
  date: string;
  duree: number; // duration in seconds
  rang: number;
}

export interface Intervention {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  technicien: string;
  user_author_id?: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  statut: InterventionStatut;
  fk_statut: number;
  type: InterventionType;
  description: string;
  descriptionClient?: string;
  compteRendu?: string;
  lines?: InterventionLine[];
}

export interface Client {
  id: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville: string;
  telephone: string;
  email: string;
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
}

export interface DolibarrUser {
  id: string;
  login: string;
  firstname: string;
  lastname: string;
  email: string;
  statut: number;
  fullname: string;
}

// --- Extrafields probe for interventions (fichinter) ---

let _extrafieldsProbeResult: Record<string, any> | null | undefined = undefined;

export async function probeFichinterExtrafields(): Promise<Record<string, any> | null> {
  if (_extrafieldsProbeResult !== undefined) return _extrafieldsProbeResult;
  try {
    const result = await dolibarrGet<any[]>('/setup/extrafields?elementtype=fichinter');
    if (result && Array.isArray(result) && result.length > 0) {
      const fields: Record<string, any> = {};
      result.forEach((f: any) => { fields[f.name || f.attrname] = f; });
      _extrafieldsProbeResult = fields;
      console.info('Extrafields fichinter détectés:', Object.keys(fields));
    } else {
      _extrafieldsProbeResult = null;
      console.info('Aucun extrafield fichinter — fallback note_private JSON');
    }
  } catch {
    _extrafieldsProbeResult = null;
    console.warn('Probe extrafields fichinter échouée — fallback note_private JSON');
  }
  return _extrafieldsProbeResult;
}

export function getExtrafieldsProbeResult(): Record<string, any> | null | undefined {
  return _extrafieldsProbeResult;
}



async function dolibarrCall<T>(endpoint: string, method = 'GET', data?: unknown): Promise<T | null> {
  try {
    const { data: result, error } = await supabase.functions.invoke('dolibarr-proxy', {
      body: { endpoint, method, data },
    });
    if (error) throw error;
    if (result && typeof result === 'object' && 'ok' in result) {
      if (!result.ok) {
        const errMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error || `Dolibarr ${result.status}`);
        console.error(`Dolibarr API ${result.status}:`, result.error);
        throw new Error(errMsg);
      }
      return result.data as T;
    }
    return result as T;
  } catch (e) {
    console.error('Dolibarr proxy error:', e);
    throw e;
  }
}

// Safe version for GET that returns null instead of throwing
async function dolibarrGet<T>(endpoint: string): Promise<T | null> {
  try {
    return await dolibarrCall<T>(endpoint, 'GET');
  } catch {
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

// --- Raw fetch (no client resolution) ---

async function fetchClientsRaw(): Promise<Client[]> {
  const result = await dolibarrGet<any[]>('/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  return result.map(mapDolibarrClient);
}

// --- Status labels (native Dolibarr codes) ---

export const DEVIS_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Validé',
  2: 'Signé',
  3: 'Refusé',
  4: 'Facturé',
};

export const FACTURE_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Impayée',
  2: 'Payée',
  3: 'Abandonnée',
};

export const INTERVENTION_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Validée',
  2: 'En cours',
  3: 'Terminée',
  5: 'Fermée',
};

export function getDevisStatutLabel(fk_statut: number): string {
  return DEVIS_STATUTS[fk_statut] || `Statut ${fk_statut}`;
}

export function getFactureStatutLabel(fk_statut: number, paye: boolean, totalPaye?: number): string {
  if (paye) return 'Payée';
  if (fk_statut === 3) return 'Abandonnée';
  if (fk_statut === 0) return 'Brouillon';
  if (fk_statut >= 1 && !paye && (totalPaye || 0) > 0) return 'Partiellement payée';
  if (fk_statut >= 1) return 'Impayée';
  return `Statut ${fk_statut}`;
}

export function getInterventionStatutLabel(fk_statut: number): string {
  return INTERVENTION_STATUTS[fk_statut] || `Statut ${fk_statut}`;
}

// --- API Fetch functions ---

export async function fetchFactures(): Promise<Facture[]> {
  const result = await dolibarrGet<any[]>('/invoices?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  const mapped = result.map(mapDolibarrFacture);
  try {
    const clients = await getClientsCache();
    return mapped.map(f => ({ ...f, client: resolveClientName(f.socid, clients, f.client) }));
  } catch { return mapped; }
}

export async function fetchDevis(): Promise<Devis[]> {
  const result = await dolibarrGet<any[]>('/proposals?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  const mapped = result.map(mapDolibarrDevis);
  try {
    const clients = await getClientsCache();
    return mapped.map(d => ({ ...d, client: resolveClientName(d.socid, clients, d.client) }));
  } catch { return mapped; }
}

export async function fetchInterventions(): Promise<Intervention[]> {
  // Probe extrafields on first call (lazy, cached)
  await probeFichinterExtrafields();
  const result = await dolibarrGet<any[]>('/interventions?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
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
  const result = await dolibarrGet<any[]>('/products?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  return result.map(mapDolibarrProduit);
}

export async function fetchDolibarrUsers(): Promise<DolibarrUser[]> {
  const result = await dolibarrGet<any[]>('/users?sortfield=t.rowid&sortorder=ASC&limit=500');
  if (!result) return [];
  return result.map((u: any) => ({
    id: String(u.id),
    login: u.login || '',
    firstname: u.firstname || '',
    lastname: u.lastname || '',
    email: u.email || '',
    statut: Number(u.statut) || 0,
    fullname: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
  })).filter((u: DolibarrUser) => u.statut === 1);
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

export async function updateProduit(id: string, data: { label: string; description?: string; price: number; type: number; tva_tx?: number; cost_price?: number }): Promise<string | null> {
  const body: Record<string, unknown> = {
    label: data.label,
    description: data.description || '',
    price: data.price,
    type: data.type,
  };
  if (data.tva_tx !== undefined) body.tva_tx = data.tva_tx;
  if (data.cost_price !== undefined) body.cost_price = data.cost_price;
  return dolibarrCall<string>(`/products/${id}`, 'PUT', body);
}

export async function updateIntervention(id: string, data: {
  description?: string;
  note_public?: string;
  note_private?: string;
  socid?: string;
  dateo?: number;
  datee?: number;
  fk_user_assign?: string;
  array_options?: Record<string, any>;
}): Promise<string | null> {
  const body: any = {};
  if (data.description !== undefined) body.description = data.description;
  if (data.note_public !== undefined) body.note_public = data.note_public;
  if (data.note_private !== undefined) body.note_private = data.note_private;
  if (data.socid !== undefined) body.socid = parseInt(data.socid, 10) || data.socid;
  if (data.dateo !== undefined) {
    body.date = data.dateo;
    body.dateo = data.dateo;
    body.datee = data.datee ?? data.dateo;
  }
  if (data.fk_user_assign !== undefined) body.fk_user_assign = data.fk_user_assign;
  if (data.array_options !== undefined) body.array_options = data.array_options;
  return dolibarrCall<string>(`/interventions/${id}`, 'PUT', body);
}

export async function createIntervention(data: {
  socid: string;
  description: string;
  date: string;
  heureDebut?: string;
  heureFin?: string;
  fk_user_assign?: string;
  type?: string;
  note_private?: string;
}): Promise<string> {
  const socidInt = parseInt(data.socid, 10) || data.socid;
  
  const baseDate = data.date; // YYYY-MM-DD
  const startTime = data.heureDebut || '08:00';
  const endTime = data.heureFin || '10:00';
  const dateTimestamp = Math.floor(new Date(`${baseDate}T12:00:00`).getTime() / 1000);
  
  const body: any = {
    socid: socidInt,
    fk_soc: socidInt,
    fk_project: 0,
    description: data.description || ' ',
    date: dateTimestamp,
  };
  
  if (data.fk_user_assign) body.fk_user_assign = data.fk_user_assign;

  // Use extrafields if available, otherwise fallback to note_private JSON
  const extrafields = getExtrafieldsProbeResult();
  if (extrafields && (extrafields['type_intervention'] || extrafields['heure_debut'] || extrafields['heure_fin'])) {
    body.array_options = {};
    if (extrafields['type_intervention']) body.array_options.options_type_intervention = data.type || 'devis';
    if (extrafields['heure_debut']) body.array_options.options_heure_debut = startTime;
    if (extrafields['heure_fin']) body.array_options.options_heure_fin = endTime;
    body.note_private = data.note_private || '';
  } else {
    // Fallback: serialize metadata into note_private as JSON
    body.note_private = JSON.stringify({
      type: data.type || 'devis',
      technicien: data.fk_user_assign || '',
      heureDebut: startTime,
      heureFin: endTime,
      dateIntervention: baseDate,
      notePrivee: data.note_private || '',
    });
  }
  
  const result = await dolibarrCall<string>('/interventions', 'POST', body);
  const newId = result || '';
  if (newId) {
    try {
      const inter = await dolibarrGet<any>(`/interventions/${newId}`);
      if (inter?.ref) {
        await ensureFichinterPdfReady(inter.ref);
      }
    } catch (e) {
      console.warn('Auto builddoc after create failed:', e);
    }
  }
  return newId;
}

// --- Devis ---

export interface CreateDevisLine {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type?: number;
  pa_ht?: number;
}

export async function createDevis(socid: string, lines: CreateDevisLine[], note_private?: string): Promise<string> {
  const body: any = {
    socid: parseInt(socid, 10) || socid,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
  };
  if (note_private) body.note_private = note_private;
  const result = await dolibarrCall<string>('/proposals', 'POST', body);
  return result || '';
}

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

// --- Factures ---

export async function createFacture(socid: string, lines: CreateDevisLine[], note_private?: string): Promise<string> {
  const body: any = {
    socid: parseInt(socid, 10) || socid,
    type: 0,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
  };
  if (note_private) body.note_private = note_private;
  const result = await dolibarrCall<string>('/invoices', 'POST', body);
  return result || '';
}

export async function validateFacture(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}/validate`, 'POST');
}

export async function deleteFacture(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}`, 'DELETE');
}

// Swagger-confirmed: POST /invoices/{id}/settodraft
export async function setFactureToDraft(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}/settodraft`, 'POST', { idwarehouse: -1 });
}

// Swagger-confirmed: POST /invoices/{id}/settounpaid
export async function setFactureToUnpaid(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/invoices/${id}/settounpaid`, 'POST');
}

// Swagger-confirmed: POST /proposals/{id}/settodraft
export async function setDevisToDraft(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/settodraft`, 'POST');
}

export async function convertDevisToFacture(devisId: string): Promise<string | null> {
  // Swagger-compliant: GET devis lines, POST /invoices, then mark devis as invoiced
  const devis = await dolibarrCall<any>(`/proposals/${devisId}`, 'GET');
  if (!devis) throw new Error('Devis introuvable');
  const lines = (devis.lines || []).map((l: any) => ({
    desc: l.desc || l.label || '',
    qty: parseFloat(l.qty) || 1,
    subprice: parseFloat(l.subprice) || 0,
    tva_tx: parseFloat(l.tva_tx) || 0,
    product_type: parseInt(l.product_type || '0', 10),
    pa_ht: parseFloat(l.pa_ht) || 0,
  }));
  const result = await dolibarrCall<string>('/invoices', 'POST', {
    socid: parseInt(devis.socid, 10) || devis.socid,
    type: 0,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
    linked_objects: { propal: devisId },
    note_private: `Facture créée depuis devis ${devis.ref || devisId}`,
  });
  // Mark devis as invoiced
  try { await setDevisInvoiced(devisId); } catch (e) { console.warn('setinvoiced failed:', e); }
  return result;
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

// --- Products ---

export async function createProduit(data: { ref: string; label: string; description?: string; price: number; tva_tx: number; type: number; cost_price?: number }): Promise<string> {
  const body: Record<string, unknown> = {
    ref: data.ref,
    label: data.label,
    description: data.description || '',
    price: data.price,
    tva_tx: data.tva_tx,
    type: data.type,
    status: 1,
    status_buy: 1,
  };
  if (data.cost_price !== undefined) body.cost_price = data.cost_price;
  const result = await dolibarrCall<string>('/products', 'POST', body);
  return result || '';
}

export async function deleteProduit(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/products/${id}`, 'DELETE');
}

export async function deleteIntervention(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}`, 'DELETE');
}

// --- Intervention status transitions ---

export async function validateIntervention(id: string): Promise<string | null> {
  const result = await dolibarrCall<string>(`/interventions/${id}/validate`, 'POST');
  try {
    const inter = await dolibarrGet<any>(`/interventions/${id}`);
    if (inter?.ref) {
      await ensureFichinterPdfReady(inter.ref);
    }
  } catch (e) {
    console.warn('Auto builddoc after validate failed:', e);
  }
  return result;
}

export async function closeIntervention(id: string): Promise<string | null> {
  // Swagger: POST /interventions/{id}/close — NO body parameters — sets status to closed (5)
  return dolibarrCall<string>(`/interventions/${id}/close`, 'POST');
}

// For intermediate status transitions (1→2 En cours, 2→3 Terminée) — use PUT
export async function setInterventionStatus(id: string, status: number): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}`, 'PUT', { fk_statut: status });
}

export async function reopenIntervention(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${id}/reopen`, 'POST');
}

// --- Intervention Lines CRUD ---

export async function fetchInterventionLines(id: string): Promise<InterventionLine[]> {
  const result = await dolibarrGet<any[]>(`/interventions/${id}/lines`);
  if (!result || !Array.isArray(result)) return [];
  return result.map((l: any) => ({
    id: String(l.id || l.rowid),
    description: l.description || l.desc || '',
    date: parseDolibarrDate(l.date),
    duree: parseInt(l.duree || l.duration || '0', 10),
    rang: parseInt(l.rang || '0', 10),
  }));
}

export async function addInterventionLine(interventionId: string, data: {
  description: string;
  date: string;
  duree: number;
}): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${interventionId}/lines`, 'POST', {
    description: data.description,
    date: toUnixTimestamp(data.date + 'T12:00:00'),
    duree: data.duree,
  });
}

export async function updateInterventionLine(interventionId: string, lineId: string, data: {
  description: string;
  date: string;
  duree: number;
}): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${interventionId}/lines/${lineId}`, 'PUT', {
    description: data.description,
    date: toUnixTimestamp(data.date + 'T12:00:00'),
    duree: data.duree,
  });
}

export async function deleteInterventionLine(interventionId: string, lineId: string): Promise<string | null> {
  return dolibarrCall<string>(`/interventions/${interventionId}/lines/${lineId}`, 'DELETE');
}

// --- Mark devis as invoiced after conversion ---
export async function setDevisInvoiced(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/setinvoiced`, 'POST');
}

// --- Fichinter PDF: now generated locally via jsPDF (see interventionPdf.ts) ---
// Server-side builddoc removed due to Dolibarr 403 on fichinter module.

// --- PDF generation via Dolibarr builddoc ---

export type DolibarrModulepart = 'propal' | 'facture' | 'fichinter';

function base64ToBlobUrl(base64: string): string {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function generatePDF(
  modulepart: DolibarrModulepart,
  id: string,
  ref: string,
  model?: string
): Promise<string | null> {
  if (modulepart === 'fichinter') {
    // Fichinter PDFs are now generated locally — this path should not be called
    throw new Error('Fichinter PDF must be generated locally via generateInterventionPdfLocal');
  }
  const defaultModel = modulepart === 'propal' ? 'azur' : 'crabe';
  const result = await dolibarrCall<any>('/documents/builddoc', 'PUT', {
    modulepart,
    original_file: `${ref}/${ref}.pdf`,
    doctemplate: model || defaultModel,
    langcode: 'fr_FR',
  });
  if (!result) return null;
  if (result.content) return base64ToBlobUrl(result.content);
  return result?.filename || null;
}

// generateFichinterPDF removed — use generateInterventionPdfLocal from interventionPdf.ts

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
  // For fichinter, use the fallback logic
  if (modulepart === 'fichinter') {
    return generateFichinterPDF(ref);
  }
  const result = await dolibarrGet<any>(
    `/documents/download?modulepart=${modulepart}&original_file=${encodeURIComponent(ref + '/' + ref + '.pdf')}`
  );
  if (!result?.content) return null;
  return base64ToBlobUrl(result.content);
}

// --- Send by email via Edge Function + PDF attachment ---
// sendByEmail endpoints don't exist in standard Dolibarr REST API.
// New flow: generate PDF first, then send via edge function SMTP.

export async function sendDocumentByEmail(
  modulepart: DolibarrModulepart,
  id: string,
  ref: string,
  to: string,
  subject: string,
  message: string,
  model?: string
): Promise<void> {
  // Step 1: Generate PDF via builddoc
  const defaultModel = modulepart === 'propal' ? 'azur' : modulepart === 'facture' ? 'crabe' : 'soleil';
  await dolibarrCall<any>('/documents/builddoc', 'PUT', {
    modulepart,
    original_file: `${ref}/${ref}.pdf`,
    doctemplate: model || defaultModel,
    langcode: 'fr_FR',
  });

  // Step 2: Download the generated PDF as base64
  const pdfResult = await dolibarrCall<any>(
    `/documents/download?modulepart=${modulepart}&original_file=${encodeURIComponent(ref + '/' + ref + '.pdf')}`,
    'GET'
  );
  if (!pdfResult?.content) throw new Error('Impossible de récupérer le PDF généré');

  // Step 3: Send via edge function SMTP
  const { error } = await supabase.functions.invoke('send-email-smtp', {
    body: {
      to,
      subject,
      message,
      pdfBase64: pdfResult.content,
      pdfFilename: `${ref}.pdf`,
    },
  });
  if (error) throw error;
}

// Legacy wrappers for backward compatibility
export async function sendDevisByEmail(id: string, to: string, subject: string, message: string): Promise<void> {
  const devis = await dolibarrCall<any>(`/proposals/${id}`, 'GET');
  const ref = devis?.ref || `PR-${id}`;
  return sendDocumentByEmail('propal', id, ref, to, subject, message);
}

export async function sendFactureByEmail(id: string, to: string, subject: string, message: string): Promise<void> {
  const facture = await dolibarrCall<any>(`/invoices/${id}`, 'GET');
  const ref = facture?.ref || `FA-${id}`;
  return sendDocumentByEmail('facture', id, ref, to, subject, message);
}

export async function sendInterventionByEmail(id: string, to: string, subject: string, message: string): Promise<void> {
  const intervention = await dolibarrCall<any>(`/interventions/${id}`, 'GET');
  const ref = intervention?.ref || `FI-${id}`;
  return sendDocumentByEmail('fichinter', id, ref, to, subject, message);
}

// --- Bulk operations ---

export async function bulkDeleteDevis(ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(id => dolibarrCall(`/proposals/${id}`, 'DELETE')));
}

export async function bulkDeleteFactures(ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map(id => dolibarrCall(`/invoices/${id}`, 'DELETE')));
}

// --- Update lines (PUT, draft only) ---

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
  const result = await dolibarrGet<any>(`/invoices/${factureId}`);
  if (!result) return { paye: false, totalPaie: 0 };
  return {
    paye: result.paye === '1' || result.paye === 1,
    totalPaie: parseFloat(result.sumpayed || result.total_paye || '0') || 0,
  };
}

// --- Dolibarr user sync ---

export async function createDolibarrUser(data: { login: string; firstname: string; lastname: string; email: string }): Promise<string | null> {
  try {
    const result = await dolibarrCall<string>('/users', 'POST', {
      login: data.login,
      firstname: data.firstname,
      lastname: data.lastname,
      email: data.email,
      statut: 1,
    });
    return result;
  } catch (error: any) {
    const msg = error?.message || String(error);
    // If user already exists in Dolibarr, find and return existing ID
    if (msg.includes('existe déjà') || msg.includes('already exist')) {
      const existing = await dolibarrGet<any[]>(`/users?sqlfilters=(t.login='${encodeURIComponent(data.login)}')`);
      if (existing && existing.length > 0) {
        return String(existing[0].id);
      }
    }
    throw error;
  }
}

export async function deleteDolibarrUser(dolibarrUserId: string): Promise<string | null> {
  return dolibarrCall<string>(`/users/${dolibarrUserId}`, 'DELETE');
}

export async function disableDolibarrUser(dolibarrUserId: string): Promise<string | null> {
  return dolibarrCall<string>(`/users/${dolibarrUserId}`, 'PUT', { statut: 0 });
}

export async function getDolibarrUserByEmail(email: string): Promise<any | null> {
  const users = await dolibarrGet<any[]>(`/users?sqlfilters=(t.email='${encodeURIComponent(email)}')`);
  return users && users.length > 0 ? users[0] : null;
}

// --- Payment ---

export async function addPayment(invoiceId: string, data: {
  datepaye: string;
  paymentid: number;
  closepaidinvoices: string;
  amount: number;
  accountid?: number;
}): Promise<string | null> {
  // Swagger requires accountid (mandatory field)
  const result = await dolibarrCall<string>(`/invoices/${invoiceId}/payments`, 'POST', {
    datepaye: toUnixTimestamp(data.datepaye),
    payment_id: data.paymentid,
    closepaidinvoices: data.closepaidinvoices,
    amount: data.amount,
    accountid: data.accountid || 1,
  });
  return result;
}

// --- User update ---

export async function updateDolibarrUser(dolibarrUserId: string, data: { firstname?: string; lastname?: string; email?: string }): Promise<string | null> {
  return dolibarrCall<string>(`/users/${dolibarrUserId}`, 'PUT', data);
}

// --- Signature persistence (now via Supabase table) ---

export async function saveInterventionSignatures(id: string, signatureClient?: string, signatureTech?: string, ref?: string): Promise<void> {
  const { error: upsertError } = await supabase
    .from('intervention_signatures')
    .upsert({
      intervention_id: id,
      intervention_ref: ref || null,
      signature_client: signatureClient || null,
      signature_tech: signatureTech || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'intervention_id' });
  if (upsertError) throw upsertError;
}

export async function getInterventionSignatures(interventionId: string): Promise<{ signature_client: string | null; signature_tech: string | null } | null> {
  const { data, error } = await supabase
    .from('intervention_signatures')
    .select('signature_client, signature_tech')
    .eq('intervention_id', interventionId)
    .maybeSingle();
  if (error) { console.warn('Error fetching signatures:', error); return null; }
  return data;
}

// --- Email variable replacement ---

export function replaceEmailVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([A-Z_]+)\]/g, (match, key) => vars[key] || match);
}

export async function testDolibarrConnection(): Promise<boolean> {
  try {
    const result = await dolibarrCall<any>('/status');
    return result !== null;
  } catch {
    return false;
  }
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

// --- Resolve technician name from user_author_id ---

export function resolveTechnicianName(userAuthorId: string | undefined, dolibarrUsers: DolibarrUser[]): string {
  if (!userAuthorId) return '';
  const user = dolibarrUsers.find(u => u.id === String(userAuthorId));
  return user ? user.fullname : '';
}

// --- Mapping Dolibarr → App types ---

function mapDolibarrFacture(d: any): Facture {
  const fk_statut = Number(d.fk_statut) || 0;
  const paye = d.paye === '1' || d.paye === 1;
  const totalPaye = parseFloat(d.sumpayed) || 0;
  const resteAPayer = parseFloat(d.remaintopay) || (parseFloat(d.total_ttc) || 0) - totalPaye;
  return {
    id: String(d.id),
    ref: d.ref || `FA-${d.id}`,
    client: d.thirdparty?.name || d.nom || d.client_nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    date: parseDolibarrDate(d.date || d.datef || d.date_creation),
    montantHT: parseFloat(d.total_ht) || 0,
    montantTTC: parseFloat(d.total_ttc) || 0,
    statut: getFactureStatutLabel(fk_statut, paye, totalPaye),
    fk_statut,
    paye,
    resteAPayer,
    totalPaye,
    lignes: (d.lines || []).map((l: any) => ({
      designation: l.desc || l.label || '',
      quantite: parseFloat(l.qty) || 0,
      prixUnitaire: parseFloat(l.subprice) || 0,
      totalHT: parseFloat(l.total_ht) || 0,
      prixAchat: parseFloat(l.pa_ht) || 0,
    })),
    note_private: d.note_private || undefined,
  };
}

function mapDolibarrDevis(d: any): Devis {
  const fk_statut = Number(d.fk_statut) || 0;
  return {
    id: String(d.id),
    ref: d.ref || `DE-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    date: parseDolibarrDate(d.date || d.datep || d.date_creation),
    montantHT: parseFloat(d.total_ht) || 0,
    montantTTC: parseFloat(d.total_ttc) || 0,
    statut: getDevisStatutLabel(fk_statut),
    fk_statut,
    lignes: (d.lines || []).map((l: any) => ({
      designation: l.desc || l.label || '',
      quantite: parseFloat(l.qty) || 0,
      prixUnitaire: parseFloat(l.subprice) || 0,
      totalHT: parseFloat(l.total_ht) || 0,
      prixAchat: parseFloat(l.pa_ht) || 0,
    })),
    finValidite: parseDolibarrDate(d.fin_validite || d.duree_validite || ''),
    note_private: d.note_private || undefined,
  };
}

function parseDolibarrTime(val: any): string {
  if (!val || val === '0') return '';
  const num = Number(val);
  if (!isNaN(num) && num > 0) {
    const d = new Date(num * 1000);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return '';
}

function parseNotePrivateMetadata(notePrivate: string | null | undefined): {
  type: string; technicien: string; heureDebut: string; heureFin: string; dateIntervention?: string; notePrivee: string;
} | null {
  if (!notePrivate) return null;
  try {
    const parsed = JSON.parse(notePrivate);
    if (parsed && typeof parsed === 'object' && ('type' in parsed || 'heureDebut' in parsed)) {
      return parsed;
    }
  } catch { /* not JSON, legacy intervention */ }
  return null;
}

function mapDolibarrIntervention(d: any): Intervention {
  const fk_statut = Number(d.fk_statut ?? d.statut ?? d.status) || 0;
  const opts = d.array_options || {};
  
  // Parse metadata from note_private JSON (fallback)
  const meta = parseNotePrivateMetadata(d.note_private);
  
  // Priority: extrafields > note_private JSON > defaults
  const technicien = opts.options_technicien
    || meta?.technicien
    || (d.user_author?.firstname ? `${d.user_author.firstname} ${d.user_author.lastname || ''}`.trim() : '')
    || (d.user_creation_id ? String(d.user_creation_id) : '');
  
  const rawType = opts.options_type_intervention || meta?.type || opts.options_type || 'devis';
  const interventionType = rawType === 'devis_sur_place' ? 'devis' : rawType === 'realisation' ? 'chantier' : rawType;
  
  const heureDebut = opts.options_heure_debut || meta?.heureDebut || parseDolibarrTime(d.dateo) || '08:00';
  const heureFin = opts.options_heure_fin || meta?.heureFin || parseDolibarrTime(d.datee) || '10:00';
  
  const rawDate = meta?.dateIntervention || d.datest || d.datei || d.dateo || d.date || d.date_creation || d.datec;
  
  return {
    id: String(d.id),
    ref: d.ref || `INT-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    technicien,
    user_author_id: d.user_author_id ? String(d.user_author_id) : (d.user_creation_id ? String(d.user_creation_id) : undefined),
    date: parseDolibarrDate(rawDate),
    heureDebut,
    heureFin,
    statut: getInterventionStatutLabel(fk_statut),
    fk_statut,
    type: interventionType as InterventionType,
    description: d.description || '',
    descriptionClient: d.note_public || '',
    compteRendu: meta?.notePrivee || (meta ? '' : (d.note_private || '')),
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

// Index-aligned with Dolibarr native statuts: 0=Brouillon, 1=Validée, 2=En cours, 3=Terminée, (4 n'existe pas), 5=Fermée
export const statutsIntervention: string[] = ['Brouillon', 'Validée', 'En cours', 'Terminée', 'Fermée'];
export const typesIntervention: { value: InterventionType; label: string }[] = [
  { value: 'devis', label: 'Devis' },
  { value: 'panne', label: 'Panne' },
  { value: 'panne_urgence', label: 'Panne urgence' },
  { value: 'sav', label: 'SAV' },
  { value: 'chantier', label: 'Chantier' },
];
