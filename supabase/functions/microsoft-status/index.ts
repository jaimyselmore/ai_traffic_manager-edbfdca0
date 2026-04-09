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
    const { werknemerId } = await req.json()

    if (!werknemerId) {
      return new Response(
        JSON.stringify({ error: 'werknemerId is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Met client credentials flow: verbonden = microsoft_email is ingesteld
    const { data, error } = await supabase
      .from('medewerkers')
      .select('microsoft_email, updated_at')
      .eq('werknemer_id', parseInt(werknemerId))
      .maybeSingle()

    if (error) throw error

    const connected = !!(data?.microsoft_email)

    return new Response(
      JSON.stringify({
        connected,
        microsoftEmail: data?.microsoft_email || null,
        connectedAt: connected ? data?.updated_at : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Fout bij controleren Microsoft status:', error)
    return new Response(
      JSON.stringify({ error: 'Kon verbindingsstatus niet ophalen', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
