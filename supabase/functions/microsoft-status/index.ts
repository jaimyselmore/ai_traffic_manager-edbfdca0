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
    // Get werknemerId from request body
    const { werknemerId } = await req.json()

    if (!werknemerId) {
      return new Response(
        JSON.stringify({ error: 'werknemerId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if token exists in microsoft_tokens table (single source of truth)
    const { data, error } = await supabase
      .from('microsoft_tokens')
      .select('created_at, token_expires_at')
      .eq('werknemer_id', parseInt(werknemerId))
      .maybeSingle()

    if (error) {
      throw error
    }

    // Connected if a token record exists
    const connected = data !== null

    return new Response(
      JSON.stringify({
        connected,
        connectedAt: data?.created_at || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('Error checking Microsoft status:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to check connection status', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
