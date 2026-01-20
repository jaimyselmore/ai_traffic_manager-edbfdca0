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
    // Get werknemerId from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const werknemerId = pathParts[pathParts.length - 1]

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

    const { data, error } = await supabase
      .from('medewerkers')
      .select('microsoft_connected, microsoft_connected_at, microsoft_email')
      .eq('werknemer_id', parseInt(werknemerId))
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        connected: data.microsoft_connected || false,
        connectedAt: data.microsoft_connected_at,
        email: data.microsoft_email,
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
