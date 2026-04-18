// Edge function : Sourcing Fournisseurs — déclenche un scan sur le site fournisseur.
// Pour l'instant : stub qui insère un batch d'articles fictifs en base.
// Prêt à brancher Firecrawl (FIRECRAWL_API_KEY) ou tout autre scraper.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
  supplier_id: string;
}

interface ScrapedItem {
  ref_externe?: string;
  designation: string;
  description?: string;
  prix_fournisseur?: number;
  devise?: string;
  url_produit?: string;
  url_image?: string;
  stock_dispo?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER : remplacer par un vrai scraping (Firecrawl, fetch + cheerio, etc.)
// ──────────────────────────────────────────────────────────────────────────────
async function scrapeSupplier(url: string): Promise<ScrapedItem[]> {
  // Si FIRECRAWL_API_KEY est dispo, on pourrait faire :
  //   const res = await fetch('https://api.firecrawl.dev/v2/scrape', { ... })
  // Pour l'instant on retourne une liste fictive démo.
  const seed = Math.floor(Math.random() * 1000);
  return [
    {
      ref_externe: `EXT-${seed}-001`,
      designation: 'Disjoncteur 16A courbe C',
      description: 'Disjoncteur modulaire 1P+N 16A courbe C, 6kA',
      prix_fournisseur: 12.5,
      devise: 'EUR',
      url_produit: `${url}/disjoncteur-16a`,
      url_image: 'https://placehold.co/200x200?text=Disjoncteur',
      stock_dispo: 'En stock',
    },
    {
      ref_externe: `EXT-${seed}-002`,
      designation: 'Câble U-1000 R2V 3G2.5 — couronne 50m',
      description: 'Câble rigide cuivre 3 conducteurs 2.5mm² gainé PVC',
      prix_fournisseur: 78.9,
      devise: 'EUR',
      url_produit: `${url}/cable-r2v-3g25`,
      url_image: 'https://placehold.co/200x200?text=Cable',
      stock_dispo: 'En stock',
    },
    {
      ref_externe: `EXT-${seed}-003`,
      designation: 'Prise murale 2P+T 16A blanche',
      description: 'Prise de courant encastrée norme NF C 15-100',
      prix_fournisseur: 4.2,
      devise: 'EUR',
      url_produit: `${url}/prise-2pt`,
      url_image: 'https://placehold.co/200x200?text=Prise',
      stock_dispo: 'Réapprovisionnement 5j',
    },
    {
      ref_externe: `EXT-${seed}-004`,
      designation: 'Tableau électrique 3 rangées 39 modules',
      prix_fournisseur: 89.0,
      devise: 'EUR',
      url_produit: `${url}/tableau-3r`,
      url_image: 'https://placehold.co/200x200?text=Tableau',
      stock_dispo: 'En stock',
    },
  ];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth : vérifier le JWT manuellement
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client utilisateur (pour vérifier l'auth)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client admin (pour bypasser RLS sur l'insert batch)
    const admin = createClient(supabaseUrl, serviceKey);

    // Vérifier que l'utilisateur est admin
    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Accès admin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const body = (await req.json()) as ScanRequest;
    if (!body.supplier_id) {
      return new Response(JSON.stringify({ error: 'supplier_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupère le fournisseur
    const { data: supplier, error: supErr } = await admin
      .from('sourcing_suppliers')
      .select('*')
      .eq('id', body.supplier_id)
      .single();
    if (supErr || !supplier) {
      return new Response(JSON.stringify({ error: 'Fournisseur introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Marque "running"
    await admin
      .from('sourcing_suppliers')
      .update({ dernier_statut: 'running', dernier_message: 'Scan en cours…' })
      .eq('id', supplier.id);

    // Lance le scrape (stub pour l'instant)
    let items: ScrapedItem[] = [];
    let errorMsg: string | null = null;
    try {
      items = await scrapeSupplier(supplier.url);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    if (errorMsg) {
      await admin
        .from('sourcing_suppliers')
        .update({
          dernier_statut: 'error',
          dernier_message: errorMsg,
          derniere_execution: new Date().toISOString(),
        })
        .eq('id', supplier.id);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Génère un batch_id et insère les articles
    const batchId = crypto.randomUUID();
    const rows = items.map((it) => ({
      supplier_id: supplier.id,
      ref_externe: it.ref_externe || null,
      designation: it.designation,
      description: it.description || null,
      prix_fournisseur: it.prix_fournisseur ?? null,
      devise: it.devise || 'EUR',
      url_produit: it.url_produit || null,
      url_image: it.url_image || null,
      stock_dispo: it.stock_dispo || null,
      scan_batch_id: batchId,
    }));

    if (rows.length > 0) {
      const { error: insErr } = await admin.from('sourcing_items').insert(rows);
      if (insErr) {
        await admin
          .from('sourcing_suppliers')
          .update({
            dernier_statut: 'error',
            dernier_message: `Insert échoué : ${insErr.message}`,
            derniere_execution: new Date().toISOString(),
          })
          .eq('id', supplier.id);
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Marque "success"
    await admin
      .from('sourcing_suppliers')
      .update({
        dernier_statut: 'success',
        dernier_message: `${rows.length} article(s) détecté(s)`,
        derniere_execution: new Date().toISOString(),
        nb_articles_detectes: rows.length,
      })
      .eq('id', supplier.id);

    return new Response(
      JSON.stringify({ ok: true, batch_id: batchId, count: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
