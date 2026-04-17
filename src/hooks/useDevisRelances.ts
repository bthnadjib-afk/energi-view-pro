import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DevisRelance {
  id: string;
  devis_id: string;
  devis_ref: string;
  client_email: string | null;
  date_envoi: string | null;
  date_relance_1: string | null;
  date_fin_validite: string | null;
  statut_relance: 'envoye' | 'a_relancer' | 'relance' | 'expire' | 'signe' | 'refuse';
  created_at: string;
  updated_at: string;
}

export function useDevisRelances() {
  return useQuery({
    queryKey: ['devis_relances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devis_relances').select('*');
      if (error) throw error;
      return (data || []) as DevisRelance[];
    },
  });
}

export function useRecordDevisEnvoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      devis_id: string;
      devis_ref: string;
      client_email: string;
      date_fin_validite?: string | null;
    }) => {
      const now = new Date().toISOString();
      // Validité 30 jours par défaut
      const finValidite =
        params.date_fin_validite ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('devis_relances')
        .upsert(
          {
            devis_id: params.devis_id,
            devis_ref: params.devis_ref,
            client_email: params.client_email,
            date_envoi: now,
            date_fin_validite: finValidite,
            statut_relance: 'envoye',
            updated_at: now,
          },
          { onConflict: 'devis_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis_relances'] });
    },
  });
}

export function useMarkDevisRelance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (devis_id: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('devis_relances')
        .update({ date_relance_1: now, statut_relance: 'relance', updated_at: now })
        .eq('devis_id', devis_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devis_relances'] });
    },
  });
}

/**
 * Calcule le statut visuel d'une relance devis.
 * Règles :
 *  - Pas d'envoi → rien
 *  - Envoyé < 7j → "Envoyé"
 *  - Envoyé ≥ 7j et pas signé → "À relancer"
 *  - Relance déjà envoyée → "Relancé"
 *  - Date fin validité dépassée → "Expiré"
 *  - fk_statut === 2 (signé) → "Signé"
 */
export function getDevisRelanceStatus(
  relance: DevisRelance | undefined,
  fk_statut: number
): { label: string; variant: 'envoye' | 'a_relancer' | 'relance' | 'expire' | 'signe' | 'none' } {
  if (fk_statut === 2) return { label: 'Signé', variant: 'signe' };
  if (!relance || !relance.date_envoi) return { label: '', variant: 'none' };

  const now = Date.now();
  if (relance.date_fin_validite && new Date(relance.date_fin_validite).getTime() < now) {
    return { label: 'Expiré', variant: 'expire' };
  }

  if (relance.statut_relance === 'relance' || relance.date_relance_1) {
    return { label: 'Relancé', variant: 'relance' };
  }

  const daysSinceEnvoi = Math.floor(
    (now - new Date(relance.date_envoi).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceEnvoi >= 7) return { label: 'À relancer', variant: 'a_relancer' };
  return { label: 'Envoyé', variant: 'envoye' };
}
