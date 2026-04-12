import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFactures, fetchDevis, fetchInterventions, fetchClients, fetchProduits, createClient, deleteClient, createIntervention, createDevis, createFacture, createProduit, convertDevisToFacture, createAcompteFacture, updateDevis, validateDevis, closeDevis, deleteDevis, deleteFacture, deleteProduit, createDolibarrUser, type CreateDevisLine } from '@/services/dolibarr';
import { toast } from 'sonner';

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

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nom: string; adresse?: string; codePostal?: string; ville?: string; telephone?: string; email?: string }) => createClient(data),
    onSuccess: () => { toast.success('Client créé avec succès'); qc.invalidateQueries({ queryKey: ['clients'] }); },
    onError: (e: any) => toast.error(`Erreur création client : ${e.message || e}`),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => { toast.success('Client supprimé'); qc.invalidateQueries({ queryKey: ['clients'] }); },
    onError: (e: any) => toast.error(`Erreur suppression client : ${e.message || e}`),
  });
}

export function useCreateIntervention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; description: string; date: string }) => createIntervention(data),
    onSuccess: () => { toast.success('Intervention créée avec succès'); qc.invalidateQueries({ queryKey: ['interventions'] }); },
    onError: (e: any) => toast.error(`Erreur création intervention : ${e.message || e}`),
  });
}

export function useCreateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; lines: CreateDevisLine[] }) => createDevis(data.socid, data.lines),
    onSuccess: () => { toast.success('Devis créé avec succès'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur création devis : ${e.message || e}`),
  });
}

export function useCreateFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; lines: CreateDevisLine[] }) => createFacture(data.socid, data.lines),
    onSuccess: () => { toast.success('Facture créée avec succès'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur création facture : ${e.message || e}`),
  });
}

export function useCreateProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ref: string; label: string; description?: string; price: number; tva_tx: number; type: number }) => createProduit(data),
    onSuccess: () => { toast.success('Article créé avec succès'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur création article : ${e.message || e}`),
  });
}

export function useDeleteProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduit(id),
    onSuccess: () => { toast.success('Article supprimé'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur suppression : ${e.message || e}`),
  });
}

export function useConvertDevisToFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (devisId: string) => convertDevisToFacture(devisId),
    onSuccess: () => { toast.success('Devis converti en facture'); qc.invalidateQueries({ queryKey: ['devis'] }); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur conversion : ${e.message || e}`),
  });
}

export function useCreateAcompte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { socid: string; montantHT: number; devisRef: string }) => createAcompteFacture(data.socid, data.montantHT, data.devisRef),
    onSuccess: () => { toast.success('Facture d\'acompte créée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur acompte : ${e.message || e}`),
  });
}

export function useUpdateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; socid: string; lines: CreateDevisLine[] }) => updateDevis(data.id, data.socid, data.lines),
    onSuccess: () => { toast.success('Devis modifié'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur modification devis : ${e.message || e}`),
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
      toast.success(vars.status === 2 ? 'Devis accepté (signé)' : 'Devis refusé');
      qc.invalidateQueries({ queryKey: ['devis'] });
    },
    onError: (e: any) => toast.error(`Erreur changement statut : ${e.message || e}`),
  });
}

export function useDeleteDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDevis(id),
    onSuccess: () => { toast.success('Devis supprimé'); qc.invalidateQueries({ queryKey: ['devis'] }); },
    onError: (e: any) => toast.error(`Erreur suppression devis : ${e.message || e}`),
  });
}

export function useDeleteFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFacture(id),
    onSuccess: () => { toast.success('Facture supprimée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur suppression facture : ${e.message || e}`),
  });
}

export function useCreateDolibarrUser() {
  return useMutation({
    mutationFn: (data: { login: string; firstname: string; lastname: string; email: string }) => createDolibarrUser(data),
    onSuccess: () => { toast.success('Utilisateur synchronisé avec Dolibarr'); },
    onError: () => { toast.warning('Utilisateur créé localement mais la synchro Dolibarr a échoué'); },
  });
}
