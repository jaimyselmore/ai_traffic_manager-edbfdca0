// Custom login edge function - verifies email/password and returns signed JWT session
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { compare } from 'https://esm.sh/bcrypt-ts@5.0.2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT secret key - derived from service role key for signing
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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email en wachtwoord zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey; // Use JWT_SECRET or fallback

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuratie fout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Look up user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, naam, password_hash, is_planner, rol')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige email of wachtwoord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.password_hash) {
      return new Response(
        JSON.stringify({ error: 'Geen wachtwoord ingesteld voor dit account' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password with bcrypt
    const passwordValid = await compare(password, user.password_hash);

    if (!passwordValid) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige email of wachtwoord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is planner
    if (!user.is_planner) {
      return new Response(
        JSON.stringify({ error: 'Geen planner rechten' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signed JWT token (expires in 24 hours)
    const key = await getJwtKey(jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 24 * 60 * 60; // 24 hours

    const sessionToken = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: user.id,
        email: user.email,
        naam: user.naam,
        isPlanner: user.is_planner,
        rol: user.rol,
        iat: now,
        exp: now + expiresIn,
      },
      key
    );

    // Return user data with session token
    const userData = {
      id: user.id,
      email: user.email,
      naam: user.naam,
      isPlanner: user.is_planner,
      rol: user.rol,
    };

    return new Response(
      JSON.stringify({ 
        user: userData, 
        sessionToken,
        expiresAt: (now + expiresIn) * 1000, // Convert to milliseconds for client
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
