import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    // Parse body
    const { email, nom, role, password } = await req.json();

    if (!email || !nom || !role) {
      return new Response(JSON.stringify({ error: "email, nom et role sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["admin", "secretaire", "technicien"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rôle invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user in Supabase
    const createPayload: any = {
      email,
      email_confirm: true,
      user_metadata: { nom },
    };
    if (password) {
      createPayload.password = password;
    }
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser(createPayload);

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile nom
    await adminClient
      .from("profiles")
      .update({ nom, email })
      .eq("id", newUser.user.id);

    // --- Sync to Dolibarr (server-side, bypasses RLS) ---
    let dolibarrUserId: string | null = null;
    if (dolibarrApiUrl && dolibarrApiKey) {
      try {
        const nameParts = nom.trim().split(" ");
        const firstname = nameParts[0] || "";
        const lastname = nameParts.slice(1).join(" ") || firstname;
        const login = email.split("@")[0];

        const doliResp = await fetch(`${dolibarrApiUrl}/users`, {
          method: "POST",
          headers: {
            DOLAPIKEY: dolibarrApiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            login,
            firstname,
            lastname,
            email,
            statut: 1,
            employee: 1,
          }),
        });

        if (doliResp.ok) {
          const doliData = await doliResp.json();
          dolibarrUserId = String(doliData);
          // Persist dolibarr_user_id in profiles (adminClient bypasses RLS)
          await adminClient
            .from("profiles")
            .update({ dolibarr_user_id: dolibarrUserId })
            .eq("id", newUser.user.id);
        } else {
          const errText = await doliResp.text();
          console.error("Dolibarr user creation failed:", errText);
        }
      } catch (e) {
        console.error("Dolibarr sync error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id, dolibarr_user_id: dolibarrUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
