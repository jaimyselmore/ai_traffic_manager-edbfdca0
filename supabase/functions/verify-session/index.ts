// Verify session token - validates JWT and returns user data
import { verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT secret key - must match the one used in custom-login
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

export interface SessionPayload {
  sub: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol: string;
  iat: number;
  exp: number;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? serviceRoleKey;

  if (!jwtSecret) {
    console.error('JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY not configured');
    return null;
  }

  try {
    const key = await getJwtKey(jwtSecret);
    const payload = await verify(token, key) as unknown as SessionPayload;
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Geen sessie token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifySessionToken(token);

    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige of verlopen sessie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return verified user data
    return new Response(
      JSON.stringify({
        user: {
          id: payload.sub,
          email: payload.email,
          naam: payload.naam,
          isPlanner: payload.isPlanner,
          rol: payload.rol,
        },
        expiresAt: payload.exp * 1000,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify session error:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
