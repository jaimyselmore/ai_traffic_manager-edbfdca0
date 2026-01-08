// Supabase Edge Function: ensure-public-user
// Ensures there is a matching row in public.users for the authenticated auth user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS, but use the caller JWT to identify the user.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUser = userData.user;

    // If a row already exists for this auth uid, do nothing.
    const { data: existingById } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (existingById?.id) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to match an existing row by email (from your imported reference users table).
    const email = (authUser.email ?? '').toLowerCase();

    const { data: existingByEmail } = await supabase
      .from('users')
      .select('naam, is_planner, rol')
      .eq('email', email)
      .maybeSingle();

    const naamFromMeta = (authUser.user_metadata?.naam as string | undefined) ?? undefined;

    const insertRow = {
      id: authUser.id,
      email,
      naam: existingByEmail?.naam ?? naamFromMeta ?? email.split('@')[0],
      password_hash: '',
      rol: existingByEmail?.rol ?? (authUser.user_metadata?.rol as string | undefined) ?? 'medewerker',
      is_planner: existingByEmail?.is_planner ?? (authUser.user_metadata?.is_planner as boolean | undefined) ?? false,
    };

    const { error: insErr } = await supabase.from('users').insert(insertRow);
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
