import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const dolibarrApiUrl = Deno.env.get("DOLIBARR_API_URL");
    const dolibarrApiKey = Deno.env.get("DOLIBARR_API_KEY");

    // Verify caller
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await anonClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check caller is admin
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Impossible de supprimer votre propre compte" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Step 1: Get profile to find dolibarr_user_id ---
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, dolibarr_user_id")
      .eq("id", user_id)
      .maybeSingle();

    // --- Step 2: Delete from Dolibarr FIRST ---
    if (dolibarrApiUrl && dolibarrApiKey) {
      let dolibarrId = profile?.dolibarr_user_id;

      // Fallback: search by email if no stored ID
      if (!dolibarrId && profile?.email) {
        try {
          const searchUrl = `${dolibarrApiUrl}/users?sqlfilters=(t.email='${encodeURIComponent(profile.email)}')`;
          const searchResp = await fetch(searchUrl, {
            headers: { DOLAPIKEY: dolibarrApiKey, Accept: "application/json" },
          });
          if (searchResp.ok) {
            const users = await searchResp.json();
            if (Array.isArray(users) && users.length > 0) {
              dolibarrId = String(users[0].id);
            }
          }
        } catch (e) {
          console.error("Dolibarr user search failed:", e);
        }
      }

      if (dolibarrId) {
        // Attempt DELETE on Dolibarr
        const deleteUrl = `${dolibarrApiUrl}/users/${dolibarrId}`;
        const deleteResp = await fetch(deleteUrl, {
          method: "DELETE",
          headers: { DOLAPIKEY: dolibarrApiKey, Accept: "application/json" },
        });

        if (!deleteResp.ok) {
          const errorBody = await deleteResp.text();
          let errorMessage: string;
          try {
            const parsed = JSON.parse(errorBody);
            errorMessage = parsed?.error?.message || parsed?.message || errorBody;
          } catch {
            errorMessage = errorBody;
          }

          // SOFT DELETE FALLBACK: try disabling user (statut=0) instead
          // Uncomment the block below to enable soft-delete fallback:
          /*
          const disableResp = await fetch(`${dolibarrApiUrl}/users/${dolibarrId}`, {
            method: "PUT",
            headers: { DOLAPIKEY: dolibarrApiKey, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ statut: 0 }),
          });
          if (disableResp.ok) {
            // Dolibarr user disabled, proceed with Supabase deletion
          } else {
          */
            // Block Supabase deletion — return Dolibarr error
            return new Response(
              JSON.stringify({
                error: `Suppression Dolibarr échouée : ${errorMessage}`,
                dolibarr_error: true,
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          /*
          }
          */
        }
      }
    }

    // --- Step 3: Delete from Supabase (only if Dolibarr succeeded or user not in Dolibarr) ---
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
