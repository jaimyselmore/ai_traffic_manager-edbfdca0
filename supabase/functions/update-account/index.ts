// Edge function to update user account settings (username/password)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { compare, hash } from 'https://esm.sh/bcrypt-ts@5.0.2';
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

    // Verify the JWT
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

    const userId = payload.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige sessie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { action, newUsername, currentPassword, newPassword } = await req.json();

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Handle username update
    if (action === 'update_username') {
      if (!newUsername || typeof newUsername !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Nieuwe gebruikersnaam is verplicht' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanUsername = newUsername.toLowerCase().trim();

      // Validate username format
      if (cleanUsername.length < 3 || cleanUsername.length > 50) {
        return new Response(
          JSON.stringify({ error: 'Gebruikersnaam moet tussen 3 en 50 tekens zijn' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!/^[a-zA-Z0-9]+$/.test(cleanUsername)) {
        return new Response(
          JSON.stringify({ error: 'Alleen letters en cijfers toegestaan' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .ilike('gebruikersnaam', cleanUsername)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking username:', checkError);
        return new Response(
          JSON.stringify({ error: 'Er ging iets mis' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Deze gebruikersnaam is al in gebruik' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update username
      const { error: updateError } = await supabase
        .from('users')
        .update({ gebruikersnaam: cleanUsername, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating username:', updateError);
        return new Response(
          JSON.stringify({ error: 'Kon gebruikersnaam niet wijzigen' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Gebruikersnaam gewijzigd' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle password update
    if (action === 'update_password') {
      if (!currentPassword || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Huidig en nieuw wachtwoord zijn verplicht' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (newPassword.length < 8 || newPassword.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Nieuw wachtwoord moet tussen 8 en 100 tekens zijn' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current user to verify password
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, password_hash')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Gebruiker niet gevonden' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify current password
      const passwordValid = await compare(currentPassword, user.password_hash);
      if (!passwordValid) {
        return new Response(
          JSON.stringify({ error: 'Huidig wachtwoord is onjuist' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash new password
      const newPasswordHash = await hash(newPassword, 10);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Kon wachtwoord niet wijzigen' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Wachtwoord gewijzigd' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ongeldige actie' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Update account error:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
