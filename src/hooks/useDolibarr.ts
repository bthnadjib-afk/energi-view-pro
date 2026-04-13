import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFactures, fetchDevis, fetchInterventions, fetchClients, fetchProduits, fetchDolibarrUsers,
  createClient, deleteClient, updateClient,
  createIntervention, updateIntervention, deleteIntervention, validateIntervention, closeIntervention, setInterventionStatus,
  createDevis, updateDevis, validateDevis, closeDevis, deleteDevis, updateDevisLines,
  createFacture, validateFacture, deleteFacture, updateFactureLines,
  convertDevisToFacture, createAcompteFacture,
  createProduit, deleteProduit, updateProduit,
  bulkDeleteDevis, bulkDeleteFactures,
  createDolibarrUser, addPayment, updateDolibarrUser, saveInterventionSignatures,
  type CreateDevisLine,
} from '@/services/dolibarr';
import { toast } from 'sonner';

// --- Queries ---

export function useFactures() {
  return useQuery({ queryKey: ['factures'], queryFn: fetchFactures });
}

export function useDevis() {
  return useQuery({ queryKey: ['devis'], queryFn: fetchDevis });
}

export function useInterventions() {
  return useQuery({ queryKey: ['interventions'], queryFn: fetchInterventions });
}

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: fetchClients });
}

export function useProduits() {
  return useQuery({ queryKey: ['produits'], queryFn: fetchProduits });
}

export function useDolibarrUsers() {
  return useQuery({ queryKey: ['dolibarr-users'], queryFn: fetchDolibarrUsers });
}

// --- Client mutations ---

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }) => createClient(data),
    onSuccess: () => { toast.success('Client créé'); qc.invalidateQueries({ queryKey: ['clients'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }) => updateClient(data.id, data),
    onSuccess: () => { toast.success('Client modifié'); qc.invalidateQueries({ queryKey: ['clients'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => { toast.success('Client supprimé'); qc.invalidateQueries({ queryKey: ['clients'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Intervention mutations ---

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      socid: string;
      description: string;
      date: string;
      heureDebut?: string;
      heureFin?: string;
      fk_user_assign?: string;
      type?: string;
      note_private?: string;
    }) => createIntervention(data),
    onSuccess: () => { toast.success('Intervention créée'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useValidateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => validateIntervention(id),
    onSuccess: () => { toast.success('Intervention validée'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useCloseIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeIntervention(id),
    onSuccess: () => { toast.success('Intervention fermée'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useSetInterventionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; status: number }) => setInterventionStatus(data.id, data.status),
    onSuccess: () => { toast.success('Statut intervention mis à jour'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      description?: string;
      note_public?: string;
      note_private?: string;
      socid?: string;
      dateo?: number;
      datee?: number;
      fk_user_assign?: string;
      array_options?: Record<string, any>;
    }) => updateIntervention(data.id, data),
    onSuccess: () => { toast.success('Intervention modifiée'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIntervention(id),
    onSuccess: () => { toast.success('Intervention supprimée'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Devis mutations ---

export function useCreateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; lines: CreateDevisLine[]; note_private?: string }) => createDevis(data.socid, data.lines, data.note_private),
    onSuccess: () => { toast.success('Devis créé'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; socid: string; lines: CreateDevisLine[] }) => updateDevis(data.id, data.socid, data.lines),
    onSuccess: () => { toast.success('Devis modifié'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useValidateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => validateDevis(id),
    onSuccess: () => { toast.success('Devis validé'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur validation : ${e.message || e}`),
  });
}

export function useCloseDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; status: number }) => closeDevis(data.id, data.status),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 2 ? 'Devis signé' : 'Devis refusé');
      qc.invalidateQueries({ queryKey: ['devis'] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDevis(id),
    onSuccess: () => { toast.success('Devis supprimé'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateDevisLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; socid: string; lines: CreateDevisLine[] }) => updateDevisLines(data.id, data.socid, data.lines),
    onSuccess: () => { toast.success('Lignes modifiées'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Facture mutations ---

export function useCreateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; lines: CreateDevisLine[]; note_private?: string }) => createFacture(data.socid, data.lines, data.note_private),
    onSuccess: () => { toast.success('Facture créée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useValidateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => validateFacture(id),
    onSuccess: () => { toast.success('Facture validée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFacture(id),
    onSuccess: () => { toast.success('Facture supprimée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Convert & Acompte ---

export function useConvertDevisToFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (devisId: string) => convertDevisToFacture(devisId),
    onSuccess: () => { toast.success('Facture générée depuis le devis'); qc.invalidateQueries({ queryKey: ['devis'] }); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useCreateAcompte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; montantHT: number; devisRef: string }) => createAcompteFacture(data.socid, data.montantHT, data.devisRef),
    onSuccess: () => { toast.success("Facture d'acompte créée"); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Produit mutations ---

export function useCreateProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ref: string; label: string; description?: string; price: number; tva_tx: number; type: number; cost_price?: number }) => createProduit(data),
    onSuccess: () => { toast.success('Article créé'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; label: string; description?: string; price: number; type: number; tva_tx?: number; cost_price?: number }) => updateProduit(data.id, data),
    onSuccess: () => { toast.success('Article modifié'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduit(id),
    onSuccess: () => { toast.success('Article supprimé'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Bulk ---

export function useBulkDeleteDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteDevis(ids),
    onSuccess: () => { toast.success('Devis supprimés'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useBulkDeleteFactures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteFactures(ids),
    onSuccess: () => { toast.success('Factures supprimées'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Dolibarr user sync ---

export function useCreateDolibarrUser() {
  return useMutation({
    mutationFn: async (data: { login: string; firstname: string; lastname: string; email: string }) => {
      const dolibarrId = await createDolibarrUser(data);
      // Store dolibarr_user_id in profiles
      if (dolibarrId) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('profiles')
          .update({ dolibarr_user_id: dolibarrId } as any)
          .eq('email', data.email);
      }
      return dolibarrId;
    },
    onSuccess: (result, variables) => {
      toast.success('Utilisateur synchronisé avec Dolibarr');
    },
    onError: (error: any) => {
      const msg = error?.message || String(error);
      if (msg.includes('existe déjà') || msg.includes('already exist')) {
        toast.success('Utilisateur Dolibarr existant lié avec succès');
      } else {
        toast.warning(`Synchro Dolibarr échouée : ${msg}`);
      }
    },
  });
}

// --- Payment ---

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceId: string; datepaye: string; paymentid: number; closepaidinvoices: string; amount: number }) =>
      addPayment(data.invoiceId, data),
    onSuccess: () => { toast.success('Paiement enregistré'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur paiement : ${e.message || e}`),
  });
}

// --- User update (Dolibarr) ---

export function useUpdateDolibarrUser() {
  return useMutation({
    mutationFn: (data: { dolibarrUserId: string; firstname?: string; lastname?: string; email?: string }) =>
      updateDolibarrUser(data.dolibarrUserId, data),
    onSuccess: () => toast.success('Utilisateur Dolibarr mis à jour'),
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

// --- Signature persistence ---

export function useSaveSignatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; signatureClient?: string; signatureTech?: string }) =>
      saveInterventionSignatures(data.id, data.signatureClient, data.signatureTech),
    onSuccess: () => { toast.success('Signatures sauvegardées'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur signatures : ${e.message || e}`),
  });
}

// --- Generate Intervention PDF (manual trigger) ---

export function useGenerateInterventionPDF() {
  return useMutation({
    mutationFn: async ({ ref }: { ref: string }) => {
      const { ensureFichinterPdfReady } = await import('@/services/dolibarr');
      return ensureFichinterPdfReady(ref);
    },
    onSuccess: () => toast.success('PDF généré avec succès'),
    onError: () => toast.error('Erreur lors de la génération du PDF, veuillez réessayer manuellement'),
  });
}

export function useUpdateFactureLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; socid: string; lines: CreateDevisLine[] }) => updateFactureLines(data.id, data.socid, data.lines),
    onSuccess: () => { toast.success('Facture modifiée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}
