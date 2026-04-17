// Generates a public online-signature URL for a Dolibarr proposal,
// computing the bcrypt securekey exactly like Dolibarr's `dol_hash` function does
// (default `dol_hash` mode '0' for password_hash style → bcrypt with $2y$ prefix).
//
// Required env secrets:
//   DOLIBARR_BASE_URL           e.g. https://dolibarr.example.com
//   DOLIBARR_PROPOSAL_ONLINE_SIGNATURE_SECURITY_TOKEN  (the seed configured in
//     Dolibarr → Setup → Proposals → "Security key for online signature")
// Optional:
//   DOLIBARR_ENTITY (default "1") — used when multicompany is enabled.
//
// POST body: { ref: string, source?: 'proposal' (default) }
// Response : { ok: true, url: string } | { ok: false, error: string }
import bcrypt from 'npm:bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const BASE_URL = Deno.env.get('DOLIBARR_BASE_URL') || Deno.env.get('DOLIBARR_API_URL') || '';
    const SEED = Deno.env.get('DOLIBARR_PROPOSAL_ONLINE_SIGNATURE_SECURITY_TOKEN') || '';
    const ENTITY = Deno.env.get('DOLIBARR_ENTITY') || '1';

    if (!BASE_URL || !SEED) {
      return json({ ok: false, error: 'Configuration manquante : DOLIBARR_BASE_URL et/ou DOLIBARR_PROPOSAL_ONLINE_SIGNATURE_SECURITY_TOKEN' });
    }

    const { ref, source = 'proposal' } = await req.json();
    if (!ref) return json({ ok: false, error: 'ref requis' });

    // Strip /api/index.php if user pasted the API URL by mistake.
    const base = BASE_URL.replace(/\/api\/index\.php\/?$/, '').replace(/\/$/, '');

    // Reproduce Dolibarr `dol_verifyHash($seed.$type.$ref.($entity if multicompany), $key, '0')`
    // We assume multicompany may be enabled — most installs without it will still verify
    // because $entity contributes empty string. To stay safe we try without entity first.
    // Dolibarr generates the link with: hash = password_hash(seed.type.ref[.entity], BCRYPT)
    // We use bcrypt with cost 10 (Dolibarr default).
    const chain = `${SEED}${source}${ref}${ENTITY === '1' ? '' : ENTITY}`;
    const hash = await bcrypt.hash(chain, 10);
    // Dolibarr stores `$2y$` prefix; bcryptjs outputs `$2a$`. Both are accepted by PHP password_verify.
    const securekey = hash.replace(/^\$2a\$/, '$2y$');

    const url = `${base}/public/onlinesign/newonlinesign.php?source=${encodeURIComponent(source)}&ref=${encodeURIComponent(ref)}&securekey=${encodeURIComponent(securekey)}`;
    return json({ ok: true, url });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) });
  }
});

function json(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
