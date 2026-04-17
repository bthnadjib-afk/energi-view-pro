// Edge function de relance automatique des factures
// Exécutée quotidiennement par pg_cron
// - 10 jours après envoi sans paiement → 1ère relance + email auto
// - 20 jours après envoi (10j après 1ère relance) → mise en demeure + email auto

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DOLIBARR_API_URL = Deno.env.get('DOLIBARR_API_URL')!;
const DOLIBARR_API_KEY = Deno.env.get('DOLIBARR_API_KEY')!;

interface DolibarrFacture {
  id: string;
  ref: string;
  paye?: string | number;
  fk_statut?: string | number;
  statut?: string | number;
  status?: string | number;
  socid?: string;
  total_ttc?: string | number;
}

async function dolibarrGet<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${DOLIBARR_API_URL}${endpoint}`, {
      headers: {
        DOLAPIKEY: DOLIBARR_API_KEY,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function sendRelanceEmail(
  to: string,
  ref: string,
  montant: number,
  type: 'relance_1' | 'mise_en_demeure',
) {
  const subject =
    type === 'relance_1'
      ? `Électricien du Genevois - 1ère relance facture ${ref}`
      : `Électricien du Genevois - Mise en demeure facture ${ref}`;

  const message =
    type === 'relance_1'
      ? `Bonjour,\n\nSauf erreur de notre part, nous n'avons pas reçu le règlement de votre facture ${ref} d'un montant de ${montant.toLocaleString('fr-FR')} € TTC.\n\nNous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.\n\nSi le règlement a été effectué récemment, merci de ne pas tenir compte de ce message.\n\nCordialement,\nÉlectricien du Genevois`
      : `Bonjour,\n\nMALGRÉ NOTRE PRÉCÉDENTE RELANCE, votre facture ${ref} d'un montant de ${montant.toLocaleString('fr-FR')} € TTC reste impayée à ce jour.\n\nNous vous mettons en demeure de procéder au règlement intégral sous 8 jours à compter de la réception de la présente.\n\nÀ défaut, nous nous verrons contraints d'engager une procédure de recouvrement avec application des pénalités de retard légales.\n\nCordialement,\nÉlectricien du Genevois`;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email-smtp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ to, subject, message }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.ok === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();
  const result = { processed: 0, relance_1: 0, mise_en_demeure: 0, errors: [] as string[] };

  try {
    // Récupérer toutes les relances actives non payées
    const { data: relances, error } = await supabase
      .from('facture_relances')
      .select('*')
      .neq('statut_relance', 'payee')
      .not('date_envoi', 'is', null);

    if (error) throw error;

    for (const r of relances || []) {
      result.processed++;
      try {
        // Vérifier l'état réel de la facture sur Dolibarr
        const facture = await dolibarrGet<DolibarrFacture>(`/invoices/${r.facture_id}`);
        if (!facture) continue;

        const paye = facture.paye === '1' || facture.paye === 1;
        if (paye) {
          await supabase
            .from('facture_relances')
            .update({ statut_relance: 'payee', updated_at: now.toISOString() })
            .eq('id', r.id);
          continue;
        }

        const montant = Number(facture.total_ttc) || 0;
        const envoi = new Date(r.date_envoi).getTime();
        const days = Math.floor((now.getTime() - envoi) / (1000 * 60 * 60 * 24));

        // Récupérer email client
        let email = r.client_email;
        if (!email && facture.socid) {
          const client = await dolibarrGet<{ email?: string }>(`/thirdparties/${facture.socid}`);
          email = client?.email || null;
        }

        // 20 jours → mise en demeure (si pas déjà envoyée)
        if (days >= 20 && !r.date_mise_en_demeure) {
          if (email) {
            const sent = await sendRelanceEmail(email, r.facture_ref, montant, 'mise_en_demeure');
            if (sent) {
              await supabase
                .from('facture_relances')
                .update({
                  date_mise_en_demeure: now.toISOString(),
                  statut_relance: 'mise_en_demeure',
                  updated_at: now.toISOString(),
                })
                .eq('id', r.id);
              result.mise_en_demeure++;
            }
          }
        }
        // 10 jours → 1ère relance (si pas déjà envoyée)
        else if (days >= 10 && !r.date_relance_1) {
          if (email) {
            const sent = await sendRelanceEmail(email, r.facture_ref, montant, 'relance_1');
            if (sent) {
              await supabase
                .from('facture_relances')
                .update({
                  date_relance_1: now.toISOString(),
                  statut_relance: 'relance_1',
                  updated_at: now.toISOString(),
                })
                .eq('id', r.id);
              result.relance_1++;
            }
          }
        }
      } catch (e) {
        result.errors.push(`${r.facture_ref}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
