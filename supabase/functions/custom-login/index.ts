// Custom login edge function - verifies email/password and returns signed JWT session
// Includes rate limiting to prevent brute-force attacks
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { compare } from 'https://esm.sh/bcrypt-ts@5.0.2';
import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const MAX_FAILED_ATTEMPTS = 5; // Max failed attempts before lockout
const LOCKOUT_WINDOW_MINUTES = 15; // Time window to count failed attempts

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

// Check rate limiting - returns number of recent failed attempts
// deno-lint-ignore no-explicit-any
async function getRecentFailedAttempts(
  supabase: SupabaseClient<any>,
  email: string
): Promise<number> {
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase().trim())
    .eq('success', false)
    .gte('created_at', windowStart);

  if (error) {
    console.error('Error checking login attempts:', error);
    return 0; // Don't block on error, but log it
  }

  return count || 0;
}

// Log login attempt
// deno-lint-ignore no-explicit-any
async function logLoginAttempt(
  supabase: SupabaseClient<any>,
  email: string,
  ipAddress: string | null,
  success: boolean
): Promise<void> {
  const { error } = await supabase
    .from('login_attempts')
    .insert({
      email: email.toLowerCase().trim(),
      ip_address: ipAddress,
      success,
    });

  if (error) {
    console.error('Error logging login attempt:', error);
  }
}

// Calculate lockout time based on failed attempts (exponential backoff)
function getLockoutMinutes(failedAttempts: number): number {
  if (failedAttempts <= MAX_FAILED_ATTEMPTS) return 0;
  // Exponential backoff: 1, 2, 4, 8, 16... minutes, max 60 minutes
  const exponent = failedAttempts - MAX_FAILED_ATTEMPTS;
  return Math.min(Math.pow(2, exponent - 1), 60);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, username } = await req.json();
    const loginIdentifier = username || email; // Accept either username or email for backwards compat

    if (!loginIdentifier || !password) {
      return new Response(
        JSON.stringify({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' }),
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

    // Get client IP address for rate limiting
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || null;

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ===== RATE LIMITING CHECK =====
    const failedAttempts = await getRecentFailedAttempts(supabase, loginIdentifier);

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutMinutes = getLockoutMinutes(failedAttempts);

      if (lockoutMinutes > 0) {
        // Log this blocked attempt
        await logLoginAttempt(supabase, loginIdentifier, ipAddress, false);
        
        return new Response(
          JSON.stringify({ 
            error: `Te veel mislukte pogingen. Probeer het over ${lockoutMinutes} ${lockoutMinutes === 1 ? 'minuut' : 'minuten'} opnieuw.`,
            code: 'RATE_LIMITED',
            retryAfter: lockoutMinutes * 60, // seconds
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(lockoutMinutes * 60),
            } 
          }
        );
      }
    }

    // Look up user by gebruikersnaam (username) - try gebruikersnaam first, fallback to email for backwards compatibility
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, gebruikersnaam, naam, password_hash, is_planner, rol')
      .or(`gebruikersnaam.eq.${loginIdentifier.toLowerCase().trim()},email.eq.${loginIdentifier.toLowerCase().trim()}`)
      .maybeSingle();

    if (userError || !user) {
      // Log failed attempt - user not found
      await logLoginAttempt(supabase, loginIdentifier, ipAddress, false);

      return new Response(
        JSON.stringify({ error: 'Ongeldige gebruikersnaam of wachtwoord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.password_hash) {
      // Log failed attempt - no password set
      await logLoginAttempt(supabase, loginIdentifier, ipAddress, false);

      return new Response(
        JSON.stringify({ error: 'Geen wachtwoord ingesteld voor dit account' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password with bcrypt
    const passwordValid = await compare(password, user.password_hash);

    if (!passwordValid) {
      // Log failed attempt - wrong password
      await logLoginAttempt(supabase, loginIdentifier, ipAddress, false);

      return new Response(
        JSON.stringify({ error: 'Ongeldige gebruikersnaam of wachtwoord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is planner
    if (!user.is_planner) {
      // Log failed attempt - not a planner (authorization failure)
      await logLoginAttempt(supabase, loginIdentifier, ipAddress, false);

      return new Response(
        JSON.stringify({ error: 'Geen planner rechten' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SUCCESS - Log and create JWT =====
    await logLoginAttempt(supabase, loginIdentifier, ipAddress, true);

    // Create signed JWT token (expires in 24 hours)
    const key = await getJwtKey(jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 24 * 60 * 60; // 24 hours

    const sessionToken = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: user.id,
        email: user.email || user.gebruikersnaam, // Use gebruikersnaam as fallback if no email
        gebruikersnaam: user.gebruikersnaam,
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
      email: user.email || user.gebruikersnaam, // Use gebruikersnaam as fallback for backwards compatibility
      gebruikersnaam: user.gebruikersnaam,
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
