import { useQuery } from '@tanstack/react-query';
import { fetchFactures, fetchDevis, fetchInterventions, fetchClients, fetchProduits } from '@/services/dolibarr';

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
