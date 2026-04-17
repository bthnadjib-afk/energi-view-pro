import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FactureRelance {
  id: string;
  facture_id: string;
  facture_ref: string;
  client_email: string | null;
  date_envoi: string | null;
  date_relance_1: string | null;
  date_mise_en_demeure: string | null;
  statut_relance: 'envoyee' | 'relance_1' | 'mise_en_demeure' | 'payee';
  created_at: string;
  updated_at: string;
}

export function useFactureRelances() {
  return useQuery({
    queryKey: ['facture_relances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facture_relances')
        .select('*');
      if (error) throw error;
      return (data || []) as FactureRelance[];
    },
  });
}

export function useRecordFactureEnvoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { facture_id: string; facture_ref: string; client_email: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('facture_relances')
        .upsert(
          {
            facture_id: params.facture_id,
            facture_ref: params.facture_ref,
            client_email: params.client_email,
            date_envoi: now,
            statut_relance: 'envoyee',
            updated_at: now,
          },
          { onConflict: 'facture_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facture_relances'] });
    },
  });
}

/**
 * Calcule l'état d'une relance pour une facture donnée.
 * - envoyée : email envoyé, < 10j → "Envoyée"
 * - relance_1 : > 10j depuis envoi sans paiement → "1ère relance"
 * - mise_en_demeure : > 20j (10j après 1ère relance) → "Mise en demeure"
 */
export function getRelanceStatus(relance: FactureRelance | undefined, paye: boolean): {
  label: string;
  variant: 'envoyee' | 'relance_1' | 'mise_en_demeure' | 'none';
} {
  if (paye) return { label: '', variant: 'none' };
  if (!relance || !relance.date_envoi) return { label: '', variant: 'none' };

  const now = Date.now();
  const envoi = new Date(relance.date_envoi).getTime();
  const daysSinceEnvoi = Math.floor((now - envoi) / (1000 * 60 * 60 * 24));

  if (daysSinceEnvoi >= 20 || relance.statut_relance === 'mise_en_demeure') {
    return { label: 'Mise en demeure', variant: 'mise_en_demeure' };
  }
  if (daysSinceEnvoi >= 10 || relance.statut_relance === 'relance_1') {
    return { label: '1ère relance', variant: 'relance_1' };
  }
  return { label: 'Envoyée', variant: 'envoyee' };
}
