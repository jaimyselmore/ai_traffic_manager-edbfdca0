// Edge function to create user accounts for planners
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { hash } from 'https://esm.sh/bcrypt-ts@5.0.2';
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get JWT key for verification
async function getJwtKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Niet geautoriseerd' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuratie fout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT
    const key = await getJwtKey(jwtSecret);
    let payload;
    try {
      payload = await verify(token, key);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Ongeldige of verlopen sessie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is planner (only planners can create accounts)
    const isPlanner = payload.isPlanner as boolean;
    if (!isPlanner) {
      return new Response(
        JSON.stringify({ error: 'Geen planner rechten' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { gebruikersnaam, naam, rol, werknemer_id, is_planner } = await req.json();

    // Validate required fields
    if (!gebruikersnaam || !naam || !rol || !werknemer_id) {
      return new Response(
        JSON.stringify({ error: 'Verplichte velden ontbreken' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate username format
    const cleanUsername = gebruikersnaam.toLowerCase().trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Gebruikersnaam moet tussen 3 en 50 tekens zijn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^[a-z0-9]+$/.test(cleanUsername)) {
      return new Response(
        JSON.stringify({ error: 'Alleen kleine letters en cijfers toegestaan in gebruikersnaam' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Check if username already exists (case-insensitive)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .ilike('gebruikersnaam', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Deze gebruikersnaam is al in gebruik' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash default password
    const defaultPassword = 'selmore2026';
    const passwordHash = await hash(defaultPassword, 10); // 10 rounds zoals in custom-login

    // Insert new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        gebruikersnaam: cleanUsername,
        naam: naam,
        rol: rol,
        werknemer_id: werknemer_id,
        is_planner: is_planner ?? true,
        password_hash: passwordHash,
      })
      .select('id, gebruikersnaam')
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return new Response(
        JSON.stringify({ error: 'Kon gebruikersaccount niet aanmaken: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.id,
          gebruikersnaam: newUser.gebruikersnaam,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Server fout: ' + (error instanceof Error ? error.message : 'Onbekend'),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
