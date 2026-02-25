// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up the invitation
    const { data: invitation, error: invError } = await supabase
      .from('microsoft_invitations')
      .select('werknemer_id, email, expires_at, used_at')
      .eq('token', token)
      .single()

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Uitnodiging niet gevonden' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if already used
    if (invitation.used_at) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Deze uitnodiging is al gebruikt' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Deze uitnodiging is verlopen' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get employee info
    const { data: employee } = await supabase
      .from('medewerkers')
      .select('naam_werknemer')
      .eq('werknemer_id', invitation.werknemer_id)
      .single()

    // Check if already connected
    const { data: existingToken } = await supabase
      .from('microsoft_tokens')
      .select('id')
      .eq('werknemer_id', invitation.werknemer_id)
      .single()

    return new Response(
      JSON.stringify({
        valid: true,
        employeeName: employee?.naam_werknemer || 'Onbekend',
        email: invitation.email,
        expiresAt: invitation.expires_at,
        alreadyConnected: !!existingToken,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error validating token:', error)
    return new Response(
      JSON.stringify({ valid: false, error: 'Er is een fout opgetreden' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
