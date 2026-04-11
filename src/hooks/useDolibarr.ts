import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFactures, fetchDevis, fetchInterventions, fetchClients, fetchProduits, createClient, createIntervention, createDevis, createFacture, createProduit, convertDevisToFacture, createAcompteFacture, type CreateDevisLine } from '@/services/dolibarr';
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
    onSuccess: () => { toast.success('Produit créé avec succès'); qc.invalidateQueries({ queryKey: ['produits'] }); },
    onError: (e: any) => toast.error(`Erreur création produit : ${e.message || e}`),
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
    mutationFn: (data: { socid: string; montantTTC: number; devisRef: string }) => createAcompteFacture(data.socid, data.montantTTC, data.devisRef),
    onSuccess: () => { toast.success('Facture d\'acompte créée'); qc.invalidateQueries({ queryKey: ['factures'] }); },
    onError: (e: any) => toast.error(`Erreur acompte : ${e.message || e}`),
  });
}
