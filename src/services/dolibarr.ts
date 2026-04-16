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
  ref: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
  totalHT: number;
  tauxTVA: number;
  productType: 'main_oeuvre' | 'fourniture';
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
  const result = await dolibarrCall<any[]>('/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=500&sqlfilters=(t.client:>:0)', 'GET');
  if (!result) return [];
  return result.map(mapDolibarrClient);
}

// --- Status labels (native Dolibarr codes) ---

export const DEVIS_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Ouvert',
  2: 'Signé',
  3: 'Refusé',
  4: 'Facturé',
};

export const FACTURE_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Non payée',
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
  if (fk_statut >= 1) return 'Non payée';
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
  // _ts cache-buster avoids HTTP 304 returning stale proposals after a status change
  const result = await dolibarrGet<any[]>(`/proposals?sortfield=t.rowid&sortorder=DESC&limit=500&_ts=${Date.now()}`);
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
    // PDF generation is now handled locally — no server builddoc call
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

export async function updateDevisSocid(id: string, socid: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}`, 'PUT', {
    socid: parseInt(socid, 10) || socid,
  });
}

export async function cloneDevis(id: string, newSocid?: string): Promise<string> {
  const devis = await dolibarrCall<any>(`/proposals/${id}`, 'GET');
  if (!devis) throw new Error('Devis introuvable');
  const lines = (devis.lines || []).map((l: any) => ({
    desc: l.desc || l.label || '',
    qty: parseFloat(l.qty) || 1,
    subprice: parseFloat(l.subprice) || 0,
    tva_tx: parseFloat(l.tva_tx) || 0,
    product_type: parseInt(l.product_type || '0', 10),
    pa_ht: parseFloat(l.pa_ht) || 0,
  }));
  const result = await dolibarrCall<string>('/proposals', 'POST', {
    socid: parseInt(newSocid || devis.socid, 10) || devis.socid,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
    note_private: `Copie du devis ${devis.ref}`,
  });
  return result || '';
}

export async function saveDevisSignatureToken(devisId: string, devisRef: string, token: string): Promise<void> {
  const supabase = (await import('@/integrations/supabase/client')).supabase;
  await supabase.from('app_config').upsert(
    { key: `devis_token_${token}`, value: JSON.stringify({ devisId, devisRef, createdAt: new Date().toISOString() }), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

export async function validateDevis(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/validate`, 'POST', { notrigger: 0 });
}

export async function closeDevis(id: string, status: number): Promise<string | null> {
  return dolibarrCall<string>(`/proposals/${id}/close`, 'POST', { status, notrigger: 0 });
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
  return dolibarrCall<string>(`/invoices/${id}/validate`, 'POST', { notrigger: 0 });
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
  const result = await dolibarrCall<string>(`/interventions/${id}/validate`, 'POST', { notrigger: 0 });
  // PDF generation is now handled locally — no server builddoc call
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

// Lines are embedded in the intervention object — no separate /lines endpoint
export async function fetchInterventionLines(id: string): Promise<InterventionLine[]> {
  const intervention = await dolibarrGet<any>(`/interventions/${id}`);
  if (!intervention || !Array.isArray(intervention.lines)) return [];
  return intervention.lines.map((l: any) => ({
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
  // POST /interventions/{id}/lines — only description is required
  return dolibarrCall<string>(`/interventions/${interventionId}/lines`, 'POST', {
    description: data.description,
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

export function openPDFInNewTab(blobUrl: string, _filename: string) {
  // Open in browser tab for direct viewing instead of forced download
  window.open(blobUrl, '_blank');
}

export async function downloadPDFUrl(
  modulepart: DolibarrModulepart,
  ref: string
): Promise<string | null> {
  // Fichinter PDFs are generated locally
  if (modulepart === 'fichinter') {
    throw new Error('Fichinter PDF must be generated locally via generateInterventionPdfLocal');
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

function getSmtpConfigFromStorage(): { smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPass?: string } {
  try {
    const raw = localStorage.getItem('electropro-config');
    if (!raw) return {};
    const cfg = JSON.parse(raw);
    return {
      smtpHost: cfg?.smtp?.host || undefined,
      smtpPort: cfg?.smtp?.port || undefined,
      smtpUser: cfg?.smtp?.user || undefined,
      smtpPass: cfg?.smtp?.pass || undefined,
    };
  } catch {
    return {};
  }
}

async function invokeSmtpEmail(body: {
  to: string;
  subject: string;
  message: string;
  pdfBase64?: string;
  pdfFilename?: string;
}): Promise<void> {
  const smtpCreds = getSmtpConfigFromStorage();
  const { data, error } = await supabase.functions.invoke('send-email-smtp', { body: { ...body, ...smtpCreds } });
  // error = FunctionsHttpError (non-2xx réseau/infra) — extraire le vrai message si possible
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx) {
        const json = await ctx.json();
        if (json?.error) msg = json.error;
      }
    } catch { /* ignore — on garde le message générique */ }
    throw new Error(msg);
  }
  // data.ok === false = erreur métier retournée par l'edge function avec HTTP 200
  if (data && !data.ok) throw new Error(data.error || 'Erreur SMTP inconnue');
}

export async function sendDocumentByEmail(
  modulepart: DolibarrModulepart,
  id: string,
  ref: string,
  to: string,
  subject: string,
  message: string,
  model?: string
): Promise<void> {
  const defaultModel = modulepart === 'propal' ? 'azur' : modulepart === 'facture' ? 'crabe' : 'soleil';
  await dolibarrCall<any>('/documents/builddoc', 'PUT', {
    modulepart,
    original_file: `${ref}/${ref}.pdf`,
    doctemplate: model || defaultModel,
    langcode: 'fr_FR',
  });

  const pdfResult = await dolibarrCall<any>(
    `/documents/download?modulepart=${modulepart}&original_file=${encodeURIComponent(ref + '/' + ref + '.pdf')}`,
    'GET'
  );
  if (!pdfResult?.content) throw new Error('Impossible de récupérer le PDF généré');

  await invokeSmtpEmail({
    to,
    subject,
    message,
    pdfBase64: pdfResult.content,
    pdfFilename: `${ref}.pdf`,
  });
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

  const { generateInterventionPdfBase64 } = await import('@/services/interventionPdf');

  const clientData = intervention?.socid
    ? await dolibarrGet<any>(`/thirdparties/${intervention.socid}`)
    : null;
  const client = clientData ? mapDolibarrClient(clientData) : undefined;

  const lines: InterventionLine[] = (intervention?.lines || []).map((l: any) => ({
    id: String(l.id || l.rowid),
    description: l.description || l.desc || '',
    date: parseDolibarrDate(l.date),
    duree: parseInt(l.duree || l.duration || '0', 10),
    rang: parseInt(l.rang || '0', 10),
  }));

  const signatures = await getInterventionSignatures(id);
  const storedConfig = typeof window !== 'undefined' ? window.localStorage.getItem('electropro-config') : null;
  const entreprise = storedConfig ? JSON.parse(storedConfig)?.entreprise : undefined;
  const mappedIntervention = mapDolibarrIntervention(intervention);
  const pdfBase64 = generateInterventionPdfBase64({
    intervention: mappedIntervention,
    client,
    lines,
    entreprise,
    signatureClient: signatures?.signature_client || undefined,
    signatureTech: signatures?.signature_tech || undefined,
  });

  await invokeSmtpEmail({
    to,
    subject,
    message,
    pdfBase64,
    pdfFilename: `${ref}.pdf`,
  });
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
    lignes: (d.lines || []).map((l: any) => {
      const rawDesc: string = l.desc || l.label || '';
      const refMatch = rawDesc.match(/^\[([^\]]+)\]\s*/);
      const ref = refMatch ? refMatch[1] : (l.product_ref || l.ref || '');
      const designation = refMatch ? rawDesc.slice(refMatch[0].length) : rawDesc;
      return {
        designation,
        ref,
        quantite: parseFloat(l.qty) || 0,
        unite: l.product_unit || l.unit || 'U',
        prixUnitaire: parseFloat(l.subprice) || 0,
        totalHT: parseFloat(l.total_ht) || 0,
        tauxTVA: parseFloat(l.tva_tx) || 0,
        productType: (parseInt(l.product_type, 10) === 1 ? 'main_oeuvre' : 'fourniture') as 'main_oeuvre' | 'fourniture',
        prixAchat: parseFloat(l.pa_ht) || 0,
      };
    }),
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
    lignes: (d.lines || []).map((l: any) => {
      const rawDesc: string = l.desc || l.label || '';
      const refMatch = rawDesc.match(/^\[([^\]]+)\]\s*/);
      const ref = refMatch ? refMatch[1] : (l.product_ref || l.ref || '');
      const designation = refMatch ? rawDesc.slice(refMatch[0].length) : rawDesc;
      return {
        designation,
        ref,
        quantite: parseFloat(l.qty) || 0,
        unite: l.product_unit || l.unit || 'U',
        prixUnitaire: parseFloat(l.subprice) || 0,
        totalHT: parseFloat(l.total_ht) || 0,
        tauxTVA: parseFloat(l.tva_tx) || 0,
        productType: (parseInt(l.product_type, 10) === 1 ? 'main_oeuvre' : 'fourniture') as 'main_oeuvre' | 'fourniture',
        prixAchat: parseFloat(l.pa_ht) || 0,
      };
    }),
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

// ============================================================
// COMMANDES CLIENTS
// ============================================================

export interface Commande {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  date: string;
  dateLivraison: string;
  montantHT: number;
  montantTTC: number;
  statut: string;
  fk_statut: number;
  lignes: DevisLigne[];
  note_private?: string;
}

export const COMMANDE_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Validée',
  2: 'En cours',
  3: 'Livrée',
  5: 'Facturée',
  6: 'Annulée',
};

export function getCommandeStatutLabel(fk_statut: number): string {
  return COMMANDE_STATUTS[fk_statut] || `Statut ${fk_statut}`;
}

function mapDolibarrCommande(d: any): Commande {
  const fk_statut = Number(d.fk_statut ?? d.statut_id ?? 0);
  return {
    id: String(d.id),
    ref: d.ref || `CO-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    date: parseDolibarrDate(d.date || d.date_commande || d.date_creation),
    dateLivraison: parseDolibarrDate(d.date_livraison || d.delivery_date || ''),
    montantHT: parseFloat(d.total_ht) || 0,
    montantTTC: parseFloat(d.total_ttc) || 0,
    statut: getCommandeStatutLabel(fk_statut),
    fk_statut,
    lignes: (d.lines || []).map((l: any) => ({
      designation: l.desc || l.label || '',
      ref: l.product_ref || l.ref || '',
      quantite: parseFloat(l.qty) || 0,
      unite: l.product_unit || l.unit || 'U',
      prixUnitaire: parseFloat(l.subprice) || 0,
      totalHT: parseFloat(l.total_ht) || 0,
      tauxTVA: parseFloat(l.tva_tx) || 0,
      productType: (parseInt(l.product_type, 10) === 1 ? 'main_oeuvre' : 'fourniture') as 'main_oeuvre' | 'fourniture',
      prixAchat: parseFloat(l.pa_ht) || 0,
    })),
    note_private: d.note_private || undefined,
  };
}

export async function fetchCommandes(): Promise<Commande[]> {
  const result = await dolibarrGet<any[]>('/orders?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  const mapped = result.map(mapDolibarrCommande);
  try {
    const clients = await getClientsCache();
    return mapped.map(c => ({ ...c, client: resolveClientName(c.socid, clients, c.client) }));
  } catch { return mapped; }
}

export async function createCommande(socid: string, lines: CreateDevisLine[], note_private?: string): Promise<string> {
  const body: any = {
    socid: parseInt(socid, 10) || socid,
    date: toUnixTimestamp(new Date().toISOString()),
    lines,
  };
  if (note_private) body.note_private = note_private;
  const result = await dolibarrCall<string>('/orders', 'POST', body);
  return result || '';
}

export async function validateCommande(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/orders/${id}/validate`, 'POST', { notrigger: 0 });
}

export async function setCommandeToDraft(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/orders/${id}/settodraft`, 'POST');
}

export async function deleteCommande(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/orders/${id}`, 'DELETE');
}

export async function convertCommandeToFacture(commandeId: string): Promise<string | null> {
  return dolibarrCall<string>(`/orders/${commandeId}/createinvoice`, 'POST');
}

// ============================================================
// FOURNISSEURS
// ============================================================

export interface Fournisseur {
  id: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville: string;
  telephone: string;
  email: string;
  siret?: string;
  categorie?: string;
}

function mapDolibarrFournisseur(d: any): Fournisseur {
  return {
    id: String(d.id),
    nom: d.name || '',
    adresse: d.address || '',
    codePostal: d.zip || '',
    ville: d.town || '',
    telephone: d.phone || '',
    email: d.email || '',
    siret: d.idprof2 || d.siren || '',
    categorie: d.typent_code || '',
  };
}

export async function fetchFournisseurs(): Promise<Fournisseur[]> {
  const result = await dolibarrGet<any[]>('/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=500&mode=2');
  if (!result) return [];
  return result.map(mapDolibarrFournisseur);
}

export async function createFournisseur(data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }): Promise<string> {
  const result = await dolibarrCall<string>('/thirdparties', 'POST', {
    name: data.nom,
    address: data.adresse || '',
    zip: data.codePostal || '',
    town: data.ville || '',
    phone: data.telephone || '',
    email: data.email || '',
    fournisseur: 1,
    supplier: 1,
  });
  return result || '';
}

export async function updateFournisseur(id: string, data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }): Promise<string | null> {
  return dolibarrCall<string>(`/thirdparties/${id}`, 'PUT', {
    name: data.nom,
    address: data.adresse || '',
    zip: data.codePostal || '',
    town: data.ville || '',
    phone: data.telephone || '',
    email: data.email || '',
  });
}

export async function deleteFournisseur(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/thirdparties/${id}`, 'DELETE');
}

// ============================================================
// CONTRATS
// ============================================================

export interface Contrat {
  id: string;
  ref: string;
  client: string;
  socid?: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  montantHT: number;
  statut: string;
  fk_statut: number;
  note?: string;
}

export const CONTRAT_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Validé',
  2: 'Actif',
  3: 'Terminé',
  5: 'Fermé',
};

export function getContratStatutLabel(fk_statut: number): string {
  return CONTRAT_STATUTS[fk_statut] || `Statut ${fk_statut}`;
}

function mapDolibarrContrat(d: any): Contrat {
  const fk_statut = Number(d.statut ?? d.fk_statut ?? 0);
  return {
    id: String(d.id),
    ref: d.ref || `CT-${d.id}`,
    client: d.thirdparty?.name || d.nom || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    titre: d.titre || d.label || d.description || '',
    dateDebut: parseDolibarrDate(d.date_start || d.date_contrat || d.date_creation),
    dateFin: parseDolibarrDate(d.date_end || ''),
    montantHT: parseFloat(d.total_ht || d.montant || '0') || 0,
    statut: getContratStatutLabel(fk_statut),
    fk_statut,
    note: d.note_private || d.description || '',
  };
}

export async function fetchContrats(): Promise<Contrat[]> {
  const result = await dolibarrGet<any[]>('/contracts?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  const mapped = result.map(mapDolibarrContrat);
  try {
    const clients = await getClientsCache();
    return mapped.map(c => ({ ...c, client: resolveClientName(c.socid, clients, c.client) }));
  } catch { return mapped; }
}

export async function createContrat(data: { socid: string; titre: string; dateDebut: string; dateFin?: string; note?: string }): Promise<string> {
  const result = await dolibarrCall<string>('/contracts', 'POST', {
    socid: parseInt(data.socid, 10) || data.socid,
    titre: data.titre,
    date_contrat: toUnixTimestamp(data.dateDebut),
    date_start: toUnixTimestamp(data.dateDebut),
    date_end: data.dateFin ? toUnixTimestamp(data.dateFin) : undefined,
    note_private: data.note || '',
  });
  return result || '';
}

export async function validateContrat(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/contracts/${id}/validate`, 'POST', { notrigger: 0 });
}

export async function closeContrat(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/contracts/${id}/close`, 'POST');
}

export async function deleteContrat(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/contracts/${id}`, 'DELETE');
}

// ============================================================
// PROJETS
// ============================================================

export interface Projet {
  id: string;
  ref: string;
  titre: string;
  client: string;
  socid?: string;
  dateDebut: string;
  dateFin: string;
  budget: number;
  statut: string;
  fk_statut: number;
  description: string;
}

export const PROJET_STATUTS: Record<number, string> = {
  0: 'Brouillon',
  1: 'En cours',
  2: 'Suspendu',
  3: 'Terminé',
};

export function getProjetStatutLabel(fk_statut: number): string {
  return PROJET_STATUTS[fk_statut] || `Statut ${fk_statut}`;
}

function mapDolibarrProjet(d: any): Projet {
  const fk_statut = Number(d.fk_statut ?? d.statut ?? 0);
  return {
    id: String(d.id),
    ref: d.ref || `PR-${d.id}`,
    titre: d.title || d.titre || d.label || '',
    client: d.thirdparty?.name || d.thirdparty_name || `Client #${d.socid}`,
    socid: String(d.socid || ''),
    dateDebut: parseDolibarrDate(d.date_start || d.date_creation),
    dateFin: parseDolibarrDate(d.date_end || ''),
    budget: parseFloat(d.budget_amount || d.budget || '0') || 0,
    statut: getProjetStatutLabel(fk_statut),
    fk_statut,
    description: d.description || d.note_public || '',
  };
}

export async function fetchProjets(): Promise<Projet[]> {
  const result = await dolibarrGet<any[]>('/projects?sortfield=t.rowid&sortorder=DESC&limit=500');
  if (!result) return [];
  return result.map(mapDolibarrProjet);
}

export async function createProjet(data: { ref?: string; titre: string; socid?: string; dateDebut: string; dateFin?: string; budget?: number; description?: string }): Promise<string> {
  const result = await dolibarrCall<string>('/projects', 'POST', {
    ref: data.ref || 'auto',
    title: data.titre,
    socid: data.socid ? (parseInt(data.socid, 10) || data.socid) : 0,
    date_start: toUnixTimestamp(data.dateDebut),
    date_end: data.dateFin ? toUnixTimestamp(data.dateFin) : undefined,
    budget_amount: data.budget || 0,
    description: data.description || '',
    fk_statut: 1,
  });
  return result || '';
}

export async function updateProjet(id: string, data: { titre?: string; dateFin?: string; budget?: number; description?: string; fk_statut?: number }): Promise<string | null> {
  const body: any = {};
  if (data.titre !== undefined) body.title = data.titre;
  if (data.dateFin !== undefined) body.date_end = toUnixTimestamp(data.dateFin);
  if (data.budget !== undefined) body.budget_amount = data.budget;
  if (data.description !== undefined) body.description = data.description;
  if (data.fk_statut !== undefined) body.fk_statut = data.fk_statut;
  return dolibarrCall<string>(`/projects/${id}`, 'PUT', body);
}

export async function deleteProjet(id: string): Promise<string | null> {
  return dolibarrCall<string>(`/projects/${id}`, 'DELETE');
}

// ============================================================
// BANQUE / COMPTES BANCAIRES
// ============================================================

export interface CompteBancaire {
  id: string;
  ref: string;
  label: string;
  number: string;
  iban: string;
  bic: string;
  solde: number;
  currency: string;
  type: string;
}

export interface LigneBancaire {
  id: string;
  date: string;
  label: string;
  montant: number;
  sens: 'D' | 'C';
  soldeApres: number;
  num_chq?: string;
}

function mapDolibarrCompte(d: any): CompteBancaire {
  return {
    id: String(d.id),
    ref: d.ref || d.code || `BA-${d.id}`,
    label: d.label || d.bank || '',
    number: d.number || d.account_number || '',
    iban: d.iban || d.iban_prefix || '',
    bic: d.bic || d.bic_swift || '',
    solde: parseFloat(d.solde || d.balance || '0') || 0,
    currency: d.currency_code || 'EUR',
    type: d.courant === 1 ? 'Courant' : d.courant === 2 ? 'Épargne' : 'Autre',
  };
}

function mapDolibarrLigne(d: any): LigneBancaire {
  const montant = parseFloat(d.amount || d.montant || '0') || 0;
  return {
    id: String(d.id || d.rowid),
    date: parseDolibarrDate(d.dateo || d.date || d.datev),
    label: d.label || d.note || '',
    montant: Math.abs(montant),
    sens: montant >= 0 ? 'C' : 'D',
    soldeApres: parseFloat(d.solde || '0') || 0,
    num_chq: d.num_chq || d.num_releve || '',
  };
}

export async function fetchComptesBancaires(): Promise<CompteBancaire[]> {
  const result = await dolibarrGet<any[]>('/bankaccounts?sortfield=t.rowid&sortorder=ASC&limit=100');
  if (!result) return [];
  return result.map(mapDolibarrCompte);
}

export async function fetchLignesBancaires(accountId: string, limit = 50): Promise<LigneBancaire[]> {
  const result = await dolibarrGet<any[]>(`/bankaccounts/${accountId}/lines?sortfield=t.rowid&sortorder=DESC&limit=${limit}`);
  if (!result) return [];
  return result.map(mapDolibarrLigne);
}

// ============================================================
// STOCK / ENTREPÔTS
// ============================================================

export interface Entrepot {
  id: string;
  ref: string;
  label: string;
  description: string;
  lieu: string;
}

export interface StockProduit {
  id: string;
  ref: string;
  label: string;
  stockReel: number;
  stockMin: number;
  entrepotId: string;
  prixHT: number;
  type: string;
}

function mapDolibarrEntrepot(d: any): Entrepot {
  return {
    id: String(d.id),
    ref: d.ref || `WH-${d.id}`,
    label: d.label || d.libelle || '',
    description: d.description || '',
    lieu: d.lieu || d.place || '',
  };
}

export async function fetchEntrepots(): Promise<Entrepot[]> {
  const result = await dolibarrGet<any[]>('/warehouses?sortfield=t.rowid&sortorder=ASC&limit=100');
  if (!result) return [];
  return result.map(mapDolibarrEntrepot);
}

export async function fetchStockProduits(entrepotId?: string): Promise<StockProduit[]> {
  const endpoint = entrepotId
    ? `/products?sortfield=t.rowid&sortorder=ASC&limit=500&warehouse_id=${entrepotId}`
    : '/products?sortfield=t.rowid&sortorder=ASC&limit=500';
  const result = await dolibarrGet<any[]>(endpoint);
  if (!result) return [];
  return result.map((d: any) => ({
    id: String(d.id),
    ref: d.ref || '',
    label: d.label || '',
    stockReel: parseFloat(d.stock_reel || d.stock || '0') || 0,
    stockMin: parseFloat(d.seuil_stock_alerte || d.stock_alerte || '0') || 0,
    entrepotId: entrepotId || '',
    prixHT: parseFloat(d.price || d.prix) || 0,
    type: d.type === '1' ? 'Service' : 'Produit',
  }));
}

export async function addStockMovement(productId: string, entrepotId: string, qty: number, label: string): Promise<string | null> {
  return dolibarrCall<string>(`/products/${productId}/stock/correct`, 'POST', {
    warehouse_id: parseInt(entrepotId, 10),
    qty: qty,
    label: label,
  });
}

// ============================================================
// RAPPORTS / STATISTIQUES
// ============================================================

export interface StatCA {
  mois: string;
  ca_ht: number;
  ca_ttc: number;
  nb_factures: number;
}

export async function fetchStatsCA(year?: number): Promise<StatCA[]> {
  const y = year || new Date().getFullYear();
  // Récupère toutes les factures payées de l'année
  const result = await dolibarrGet<any[]>(`/invoices?sortfield=t.datef&sortorder=ASC&limit=1000&status=1`);
  if (!result) return [];

  const byMonth: Record<string, { ca_ht: number; ca_ttc: number; nb: number }> = {};
  result.forEach((d: any) => {
    const dateStr = parseDolibarrDate(d.date || d.datef || d.date_creation);
    if (!dateStr) return;
    const date = new Date(dateStr);
    if (date.getFullYear() !== y) return;
    const moisKey = `${y}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[moisKey]) byMonth[moisKey] = { ca_ht: 0, ca_ttc: 0, nb: 0 };
    byMonth[moisKey].ca_ht += parseFloat(d.total_ht) || 0;
    byMonth[moisKey].ca_ttc += parseFloat(d.total_ttc) || 0;
    byMonth[moisKey].nb += 1;
  });

  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${y}-${String(i + 1).padStart(2, '0')}`;
    return {
      mois: moisLabels[i],
      ca_ht: byMonth[key]?.ca_ht || 0,
      ca_ttc: byMonth[key]?.ca_ttc || 0,
      nb_factures: byMonth[key]?.nb || 0,
    };
  });
}

// ============================================================

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
